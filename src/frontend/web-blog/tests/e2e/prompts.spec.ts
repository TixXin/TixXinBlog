/** @file prompts.spec.ts @description 灵感图鉴真实 API、博主编辑、错误恢复与三主题响应式验收 */
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { captureMotion, prepareMotionCapture } from './motionScreenshot'

test.beforeEach(({ page, browserName }) => prepareMotionCapture(page, browserName))
async function login(page: Page) {
  await page.goto('/admin/login')
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill(process.env.E2E_USERNAME!)
  await page.getByRole('textbox', { name: '密码', exact: true }).fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/admin$/)
}
async function api(request: APIRequestContext) {
  const response = await request.post('/api/v1/auth/login', {
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
  })
  expect(response.status()).toBe(200)
  const token = (await response.json()).data.accessToken
  return async (path: string, method = 'GET', data?: unknown) => {
    const result = await request.fetch('/api/v1' + path, {
      method,
      data,
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(result.status(), `${method} ${path}`).toBeLessThan(300)
    return (await result.json()).data
  }
}
async function samples(request: APIRequestContext) {
  const response = await request.get('/api/v1/prompts')
  expect(response.status()).toBe(200)
  const result = (await response.json()).data
  expect(result.total).toBeGreaterThan(12)
  return result
}

test('公开列表、搜索筛选、复制与深链详情，失败可重试且不回退样本', async ({ page, request, context, browserName }) => {
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const data = await samples(request),
    first = data.items[0]
  await page.goto('/prompts')
  await expect(page.locator('.prompt-card')).toHaveCount(12)
  await expect(page.locator('.prompts-add')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '我的草稿', exact: true })).toHaveCount(0)
  const open = page.getByRole('button', { name: `查看提示词：${first.title}`, exact: true })
  await open.press('Enter')
  const detail = page.getByRole('dialog', { name: first.title, exact: true })
  await expect(detail).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`prompt=${first.id}`))
  await expect(detail).toContainText(first.prompt)
  await detail.getByRole('button', { name: '复制提示词', exact: true }).click()
  if (browserName === 'chromium') {
    await expect(detail).toContainText('已复制')
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(first.prompt)
  } else {
    // Firefox/WebKit 不接受 Chromium 的剪贴板权限名；受系统限制时仍须给出可操作的手动复制提示。
    await expect(detail.locator('.prompt-detail__copy-status')).toContainText(
      /提示词已复制到剪贴板|复制失败，可以选中提示词文本手动复制/,
    )
    await expect(detail.locator('.prompt-detail__text p').first()).toHaveText(first.prompt)
  }
  await page.keyboard.press('Escape')
  await expect(detail).not.toBeVisible()
  await expect(open).toBeFocused()
  await page.getByRole('combobox', { name: '筛选生成模型' }).selectOption('ImageGen')
  await expect(page.locator('.prompt-card')).toHaveCount(3)
  await expect(page).toHaveURL(/model=ImageGen/)
  await page.getByRole('button', { name: '清除筛选', exact: true }).click()
  await expect(page.locator('.prompt-card')).toHaveCount(12)

  let fail = true
  await page.route('**/api/v1/prompts?*', async (route) => {
    if (fail && new URL(route.request().url()).searchParams.get('q') === first.title) {
      fail = false
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: '读取暂时不可用' }),
      })
    } else await route.continue()
  })
  await page.getByRole('textbox', { name: '搜索图片提示词' }).fill(first.title)
  await expect(page.locator('.prompts-body [role="alert"]')).toBeVisible()
  await expect(page.locator('.prompt-card')).toHaveCount(12)
  await page.locator('.prompts-body').getByRole('button', { name: '重试', exact: true }).click()
  await expect(page.locator('.prompt-card')).toHaveCount(1)
  await page.getByRole('textbox', { name: '搜索图片提示词' }).fill('没有这幅图的唯一关键词')
  await expect(page.getByText('还没有这样的灵感', { exact: true })).toBeVisible()
  await page.goto(`/prompts?prompt=${first.id}`)
  await expect(detail).toBeVisible()
  await page.reload()
  await expect(detail).toContainText(first.prompt)
})

test('过期分页链接回到有效页，清空搜索后保留可继续浏览的列表', async ({ page, request }) => {
  const data = await samples(request)
  const lastPage = Math.ceil(data.total / 12)
  await page.goto('/prompts?page=999')
  await expect(page).toHaveURL(new RegExp(`page=${lastPage}$`))
  await expect(page.locator('.prompt-card')).toHaveCount(data.total - (lastPage - 1) * 12)
  await expect(page.getByRole('button', { name: '下一页提示词', exact: true })).toBeDisabled()
  await expect(page.getByText('灵感正在酝酿', { exact: true })).toHaveCount(0)
  const search = page.getByRole('textbox', { name: '搜索图片提示词', exact: true })
  await search.fill('不存在的画面关键词')
  await expect(page.getByText('还没有这样的灵感', { exact: true })).toBeVisible()
  await expect(page).not.toHaveURL(/page=/)
  await search.fill('')
  await expect(page.locator('.prompt-card')).toHaveCount(12)
  await expect(page).not.toHaveURL(/[?&]q=/)
})

test('博主上传图片、保存草稿、公开、并发编辑与未知保存恢复', async ({ page, request, browser, baseURL }) => {
  const call = await api(request),
    title = `窗边的光影 ${randomUUID()}`
  await login(page)
  await page.goto('/prompts')
  await page.locator('.prompts-add').click()
  let editor = page.locator('.prompt-editor')
  await editor.getByLabel(/^灵感标题/).fill(title)
  await editor
    .getByLabel(/^完整提示词/)
    .fill('A ceramic cup beside a sunlit window. Soft light, natural texture.\nNo text, no watermark.')
  await editor.getByLabel('一句创作笔记', { exact: true }).fill('让午后光线留在杯沿上。')
  await editor.getByLabel('生成模型', { exact: true }).fill('Studio')
  await editor.getByLabel(/^风格标签/).fill('静物，光影')
  await editor.getByRole('button', { name: '选择或上传图片', exact: true }).click()
  const name = `prompt-${randomUUID()}.png`
  await expect(editor.getByLabel('选择或拖入图片', { exact: true })).toBeEnabled()
  await editor.getByLabel('选择或拖入图片', { exact: true }).setInputFiles({
    name,
    mimeType: 'image/png',
    buffer: Buffer.from(process.env.E2E_MEDIA_SAMPLE!, 'base64'),
  })
  await editor
    .locator('.media-library__grid > li')
    .filter({ hasText: name })
    .getByRole('button', { name: '使用此图片', exact: true })
    .click()
  await editor.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect(editor.locator('.prompt-editor__feedback')).toContainText(/已保存|已发布|已更新/)
  await editor.getByRole('button', { name: '关闭提示词编辑器', exact: true }).click()
  await expect(editor).not.toBeVisible()
  const draft = (await call(`/admin/prompts?q=${encodeURIComponent(title)}`)).items[0]
  expect(draft.status).toBe('draft')
  expect((await request.get(`/api/v1/prompts/${draft.id}`)).status()).toBe(404)
  await page.getByRole('button', { name: '我的草稿', exact: true }).click()
  await page.getByRole('button', { name: `编辑提示词：${title}`, exact: true }).click()
  editor = page.locator('.prompt-editor')
  await expect(editor.getByLabel(/^灵感标题/)).toHaveValue(title)
  await editor.getByRole('button', { name: '发布灵感', exact: true }).click()
  await expect(editor.locator('.prompt-editor__feedback')).toContainText(/已保存|已发布|已更新/)
  await editor.getByRole('button', { name: '关闭提示词编辑器', exact: true }).click()
  await expect(editor).not.toBeVisible()
  const published = await call(`/admin/prompts/${draft.id}`)
  expect(published.status).toBe('published')
  const visitor = await browser.newContext({ baseURL })
  try {
    const reader = await visitor.newPage()
    await reader.goto(`/prompts?prompt=${draft.id}`)
    await expect(reader.getByRole('dialog', { name: title, exact: true })).toBeVisible()
    await expect(reader.getByRole('button', { name: '编辑', exact: true })).toHaveCount(0)
    await page.goto(`/prompts?edit=${draft.id}`)
    await expect(editor.getByLabel(/^灵感标题/)).toHaveValue(title)
    await editor.getByLabel('一句创作笔记', { exact: true }).fill('这一份本地输入需要保留。')
    await call(`/admin/prompts/${draft.id}`, 'PATCH', {
      revision: published.revision,
      description: '另一个窗口已经修改。',
    })
    await editor.getByRole('button', { name: '保存并更新', exact: true }).click()
    await expect(editor.getByRole('alert')).toContainText('已被更新')
    await expect(editor.getByLabel('一句创作笔记', { exact: true })).toHaveValue('这一份本地输入需要保留。')
    await editor.getByRole('button', { name: '保留当前输入，按最新版本合并', exact: true }).click()
    await editor.getByRole('button', { name: '保存并更新', exact: true }).click()
    await expect(editor.locator('.prompt-editor__feedback')).toContainText(/已保存|已发布|已更新/)
    await editor.getByRole('button', { name: '关闭提示词编辑器', exact: true }).click()
    await expect(editor).not.toBeVisible()
    await reader.reload()
    await expect(reader.getByRole('dialog')).toContainText('这一份本地输入需要保留。')

    await page.goto(`/prompts?edit=${draft.id}`)
    await expect(editor.getByLabel(/^灵感标题/)).toHaveValue(title)
    await editor.getByLabel('一句创作笔记', { exact: true }).fill('网络中断后也保留这句话。')
    let failed = false
    await page.route(`**/api/v1/admin/prompts/${draft.id}`, async (route) => {
      if (!failed && route.request().method() === 'PATCH') {
        failed = true
        await route.abort('failed')
      } else await route.continue()
    })
    await editor.getByRole('button', { name: '保存并更新', exact: true }).click()
    await expect(editor.getByRole('alert')).toBeVisible()
    await expect(editor.getByLabel('一句创作笔记', { exact: true })).toHaveValue('网络中断后也保留这句话。')
    await editor.getByRole('button', { name: '保存并更新', exact: true }).click()
    await expect(editor.locator('.prompt-editor__feedback')).toContainText(/已保存|已发布|已更新/)
    await editor.getByRole('button', { name: '关闭提示词编辑器', exact: true }).click()
    await expect(editor).not.toBeVisible()
    expect((await call(`/admin/prompts/${draft.id}`)).description).toBe('网络中断后也保留这句话。')
    await page.goto(`/prompts?prompt=${draft.id}`)
    await page
      .getByRole('dialog', { name: title, exact: true })
      .getByRole('button', { name: '编辑', exact: true })
      .click()
    await expect(editor.getByLabel(/^灵感标题/)).toHaveValue(title)
    await editor.getByRole('button', { name: '转为草稿', exact: true }).click()
    await expect(editor.locator('.prompt-editor__feedback')).toContainText('草稿已保存')
    await expect(page).toHaveURL(/view=drafts/)
    await editor.getByRole('button', { name: '关闭提示词编辑器', exact: true }).click()
    const privateDetail = page.getByRole('dialog', { name: title, exact: true })
    await expect(privateDetail).toBeVisible()
    await expect(privateDetail).toContainText('草稿 · 仅博主可见')
    await expect(privateDetail.getByRole('alert')).toHaveCount(0)
    expect((await request.get(`/api/v1/prompts/${draft.id}`)).status()).toBe(404)
  } finally {
    await visitor.close()
  }
})

for (const theme of ['nexus', 'aurora', 'dock']) {
  for (const width of [320, 390, 767, 768, 1023, 1024, 1279, 1280, 1440]) {
    test(`${theme}/${width} 图片与详情布局、分页历史、键盘焦点`, async ({
      page,
      context,
      request,
      baseURL,
    }, testInfo) => {
      await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: theme, url: baseURL! }])
      await context.addInitScript(
        (mode) => localStorage.setItem('nuxt-color-mode', mode),
        width === 390 ? 'light' : 'dark',
      )
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ reducedMotion: width === 320 ? 'reduce' : 'no-preference' })
      const errors: string[] = []
      page.on('pageerror', (cause) => errors.push(cause.message))
      const data = await samples(request)
      await page.goto('/prompts')
      await expect(page.locator(`.theme-${theme}`)).toBeVisible()
      await expect(page.locator('.prompt-card')).toHaveCount(12)
      const open = page.getByRole('button', { name: `查看提示词：${data.items[0].title}`, exact: true })
      await expect(open).toBeEnabled()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
      if ([390, 1440].includes(width)) {
        await expect
          .poll(async () =>
            page.locator('.prompts-grid .image-frame').evaluateAll((frames) => {
              const visible = frames.filter((frame) => {
                const box = frame.getBoundingClientRect()
                return box.top < innerHeight && box.bottom > 0
              })
              return visible.length > 0 && visible.every((frame) => frame.classList.contains('image-frame--ready'))
            }),
          )
          .toBe(true)
        await captureMotion(page, testInfo, `prompts-${theme}-${width}.png`, { animations: 'disabled' })
      }
      await open.press('Enter')
      const detail = page.locator('.prompt-detail')
      await expect(detail).toBeVisible()
      const close = detail.getByRole('button', { name: '关闭提示词详情', exact: true })
      await expect(close).toBeFocused()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
      if ([390, 1440].includes(width)) {
        await expect(detail.locator('.image-frame')).toHaveClass(/image-frame--ready/)
        await captureMotion(page, testInfo, `prompts-detail-${theme}-${width}.png`, { animations: 'disabled' })
      }
      await page.keyboard.press('Escape')
      await expect(detail).not.toBeVisible()
      await expect(open).toBeFocused()
      await page.getByRole('button', { name: '下一页提示词', exact: true }).click()
      await expect(page).toHaveURL(/page=2/)
      await page.reload()
      await expect(page).toHaveURL(/page=2/)
      await page.goBack()
      await expect(page.locator('.prompt-card')).toHaveCount(12)
      expect(errors).toEqual([])
    })
  }
}

test('外链按自然比例呈现，移动端长提示词保留关闭入口与分享失败补救', async ({ page, request }) => {
  const call = await api(request)
  const externalImageUrl = `https://images.example.com/${randomUUID()}.png`
  const record = await call('/admin/prompts', 'POST', {
    requestId: randomUUID(),
    title: `山色与留白 ${randomUUID()}`,
    externalImageUrl,
    prompt: '远山与晨雾形成层次，让光线自然落在湖面上。\n'.repeat(150),
    status: 'published',
  })
  await page.route(externalImageUrl, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(process.env.E2E_MEDIA_SAMPLE!, 'base64'),
    }),
  )
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new DOMException('Clipboard denied', 'NotAllowedError')),
      },
    })
  })
  try {
    await page.setViewportSize({ width: 390, height: 620 })
    await page.goto(`/prompts?q=${encodeURIComponent(record.title)}`)
    const card = page.locator(`[data-prompt-id="${record.id}"]`)
    await expect(card.locator('.image-frame')).toHaveClass(/image-frame--ready/)
    await expect(card.locator('.image-frame')).toHaveCSS('aspect-ratio', '24 / 18')
    await card.getByRole('button', { name: `查看提示词：${record.title}`, exact: true }).click()
    const detail = page.getByRole('dialog', { name: record.title, exact: true })
    const share = detail.getByRole('button', { name: '分享灵感', exact: true })
    await share.scrollIntoViewIfNeeded()
    await expect(detail.getByRole('button', { name: '关闭提示词详情', exact: true })).toBeInViewport()
    expect(await detail.locator('.prompt-detail__content').evaluate((node) => node.scrollTop)).toBeGreaterThan(0)
    await share.click()
    const link = detail.getByRole('textbox', { name: '分享链接', exact: true })
    await expect(link).toHaveValue(new RegExp(`/prompts\\?prompt=${record.id}$`))
    await expect(detail.getByRole('status')).toContainText('下方链接手动复制')
    await expect(detail.getByRole('status')).toBeInViewport()
    await expect(link).toBeInViewport()
    await link.focus()
    expect(await link.evaluate((node: HTMLInputElement) => node.selectionEnd! - node.selectionStart!)).toBe(
      (await link.inputValue()).length,
    )
    await detail.getByRole('button', { name: '关闭提示词详情', exact: true }).click()
    await expect(detail).not.toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  } finally {
    const latest = await call(`/admin/prompts/${record.id}`)
    await call(`/admin/prompts/${record.id}`, 'PATCH', { revision: latest.revision, status: 'draft' })
  }
})
