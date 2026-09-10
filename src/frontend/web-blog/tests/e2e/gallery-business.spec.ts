/** @file gallery-business.spec.ts @description 隔离图库真实业务、输入恢复、灯箱 URL 与三主题浏览器验收 */
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
  await expect(page).toHaveURL(/\/admin$/, { timeout: 18000 })
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
async function upload(page: Page) {
  await page.getByRole('button', { name: '选择或上传图片', exact: true }).click()
  const picker = page.getByRole('dialog', { name: '选择媒体图片', exact: true }),
    name = `gallery-${randomUUID()}.png`
  await picker.getByLabel('新图片默认替代文本', { exact: true }).fill('窗边的光影')
  await picker
    .getByLabel('选择或拖入图片', { exact: true })
    .setInputFiles({ name, mimeType: 'image/png', buffer: Buffer.from(process.env.E2E_MEDIA_SAMPLE!, 'base64') })
  await picker
    .locator('.media-library__grid > li')
    .filter({ hasText: name })
    .getByRole('button', { name: '使用此图片', exact: true })
    .click()
  await expect(picker).not.toBeVisible()
}
async function publicSample(request: APIRequestContext) {
  const response = await request.get('/api/v1/gallery?pageSize=12')
  expect(response.status()).toBe(200)
  const data = (await response.json()).data
  expect(data.total, '隔离图库样本须覆盖两页').toBeGreaterThan(12)
  return data
}
test('创建上传发布编辑排序撤回删除在刷新与另一个上下文一致', async ({ page, browser, request, baseURL }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (cause) => errors.push(cause.message))
  const title = `窗边光影 ${randomUUID()}`,
    call = await api(request)
  await login(page)
  await page.goto('/admin/gallery/new')
  await page.getByRole('textbox', { name: '作品标题', exact: true }).fill(title)
  await page.getByRole('textbox', { name: '作品说明', exact: true }).fill('午后窗边缓慢移动的光影。')
  await page.getByRole('textbox', { name: '作品分类', exact: true }).fill('生活')
  await upload(page)
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/gallery\/\d+$/)
  const id = page.url().split('/').pop()!,
    draft = await call(`/admin/gallery/${id}`)
  expect(draft.takenOn).toBeNull()
  expect((await request.get(`/api/v1/gallery/${id}`)).status()).toBe(404)
  expect((await request.get(draft.src)).status()).toBe(200)
  const other = await browser.newContext({ baseURL })
  try {
    const reader = await other.newPage()
    await page.getByRole('button', { name: '发布作品', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('作品已保存')
    await page.reload()
    await expect(page.getByRole('textbox', { name: '作品标题', exact: true })).toHaveValue(title)
    await reader.goto(`/gallery?photo=${id}`)
    await expect(reader.getByRole('dialog', { name: title, exact: true })).toBeVisible()
    await page.getByRole('textbox', { name: '作品说明', exact: true }).fill('再次整理后的作品说明。')
    await page.getByRole('button', { name: '保存作品', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('作品已保存')
    await reader.reload()
    await expect(reader.getByRole('dialog')).toContainText('再次整理后的作品说明')
    await page.goto(`/admin/gallery?q=${encodeURIComponent(title)}`)
    const row = page.locator('.admin-gallery__list > li').filter({ hasText: title })
    await row.getByRole('button', { name: '提高排序', exact: true }).click()
    await expect(row).toContainText('排序 1')
    await captureMotion(reader, testInfo, 'gallery-published.png')
    await row.getByRole('button', { name: '撤回作品', exact: true }).click()
    await expect(row).toContainText('已撤回')
    await reader.reload()
    await expect(reader.getByRole('dialog')).toContainText('作品不存在或尚未公开')
    await expect(reader.getByRole('dialog').locator('img')).toHaveCount(0)
    page.once('dialog', (dialog) => dialog.accept())
    await row.getByRole('button', { name: '删除作品', exact: true }).click()
    await expect(row).toHaveCount(0)
    expect((await call(`/admin/media/${draft.mediaId}/references`)).total).toBe(0)
    expect((await request.get(draft.src)).status()).toBe(200)
    await page.getByRole('button', { name: '退出登录', exact: true }).click()
    await login(page)
    await page.goto(`/admin/gallery?q=${encodeURIComponent(title)}`)
    await expect(page.locator('.admin-gallery__list > li')).toHaveCount(0)
    expect(errors).toEqual([])
  } finally {
    await other.close()
  }
})
test('未知创建核查原提交，迟到保存和刷新恢复保留新输入', async ({ page, request }) => {
  const title = `保存中的光影 ${randomUUID()}`
  await login(page)
  await page.goto('/admin/gallery/new')
  await page.getByRole('textbox', { name: '作品标题', exact: true }).fill(title)
  await upload(page)
  let writes = 0
  await page.route('**/api/v1/admin/gallery', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    writes++
    const response = await route.fetch()
    expect(response.ok()).toBe(true)
    if (writes === 1) return route.abort('failed')
    await route.fulfill({ response })
  })
  await page.getByRole('button', { name: '发布作品', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('保存结果尚未核清')
  await page.getByRole('button', { name: '发布作品', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/gallery\/\d+$/)
  expect(writes).toBe(1)
  expect((await (await request.get('/api/v1/gallery?q=' + encodeURIComponent(title))).json()).data.total).toBe(1)
  const id = page.url().split('/').pop()!
  let delayed = false
  await page.route(`**/api/v1/admin/gallery/${id}`, async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue()
    const response = await route.fetch()
    expect(response.ok()).toBe(true)
    delayed = true
    await new Promise((resolve) => setTimeout(resolve, 800))
    await route.fulfill({ response })
  })
  const description = page.getByRole('textbox', { name: '作品说明', exact: true })
  await description.fill('已提交的说明')
  await page.getByRole('button', { name: '保存作品', exact: true }).click()
  await expect.poll(() => delayed).toBe(true)
  await description.fill('等待响应时的新输入')
  await expect(page.getByRole('status')).toContainText('当前新增输入仍保留')
  await expect(description).toHaveValue('等待响应时的新输入')
  page.once('dialog', (dialog) => dialog.accept())
  await page.reload()
  await expect(page.getByLabel('作品恢复副本')).toBeVisible()
  await page.getByRole('button', { name: '恢复输入', exact: true }).click()
  await expect(description).toHaveValue('等待响应时的新输入')
  expect((await (await request.get(`/api/v1/gallery/${id}`)).json()).data.description).toBe('已提交的说明')
})
test('并发版本冲突不会覆盖本机作品输入', async ({ page, request }) => {
  const call = await api(request),
    sample = (await call('/admin/gallery?pageSize=1')).items[0]
  const photo = await call('/admin/gallery', 'POST', {
    requestId: randomUUID(),
    mediaId: sample.mediaId,
    title: `并发光影 ${randomUUID()}`,
    status: 'draft',
  })
  await login(page)
  await page.goto(`/admin/gallery/${photo.id}`)
  await page.getByRole('textbox', { name: '作品说明', exact: true }).fill('本标签页的修改')
  await call(`/admin/gallery/${photo.id}`, 'PATCH', { revision: photo.revision, description: '另一个窗口的修改' })
  await page.getByRole('button', { name: '保存作品', exact: true }).click()
  await expect(page.getByLabel('作品服务器版本')).toContainText('另一个窗口的修改')
  await expect(page.getByRole('textbox', { name: '作品说明', exact: true })).toHaveValue('本标签页的修改')
  await page.getByRole('button', { name: '保留输入，按最新版本继续合并', exact: true }).click()
  await page.getByRole('button', { name: '保存作品', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('作品已保存')
  expect((await call(`/admin/gallery/${photo.id}`)).description).toBe('本标签页的修改')
})
test('列表真实失败可重试且慢查询不覆盖新的 URL 筛选', async ({ page, request }) => {
  const sample = await publicSample(request),
    one = sample.items[0],
    two = sample.items[1]
  await page.goto('/gallery')
  await expect(page.locator('.gallery-item')).toHaveCount(12)
  let failures = 0,
    slow = false
  await page.route('**/api/v1/gallery?*', async (route) => {
    const q = new URL(route.request().url()).searchParams.get('q')
    if (q === one.title && failures === 0) {
      failures++
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: '图库暂时不可用' }),
      })
    }
    if (q === one.title && slow) await new Promise((resolve) => setTimeout(resolve, 700))
    await route.continue()
  })
  const search = page.getByRole('textbox', { name: '搜索画廊照片', exact: true })
  await search.fill(one.title)
  await expect(page.locator('.gallery-body [role="alert"]')).toContainText('图库服务暂时不可用')
  expect(failures).toBe(1)
  await expect(page.locator('.gallery-item')).toHaveCount(12)
  await page.locator('.gallery-body').getByRole('button', { name: '重试', exact: true }).click()
  await expect(page.getByRole('button', { name: `查看照片：${one.title}`, exact: true })).toBeVisible()
  await search.fill(two.title)
  await expect(page.getByRole('button', { name: `查看照片：${two.title}`, exact: true })).toBeVisible()
  slow = true
  const waiting = page.waitForRequest(
    (r) => new URL(r.url()).pathname === '/api/v1/gallery' && new URL(r.url()).searchParams.get('q') === one.title,
  )
  await search.fill(one.title)
  await waiting
  await search.fill(two.title)
  await expect(page.getByRole('button', { name: `查看照片：${two.title}`, exact: true })).toBeVisible()
  await page.waitForTimeout(800)
  await expect(page.getByRole('button', { name: `查看照片：${one.title}`, exact: true })).toHaveCount(0)
})
test('关闭 JavaScript 仍输出真实图库标题、照片与筛选计数', async ({ browser, request, baseURL }) => {
  const sample = await publicSample(request),
    context = await browser.newContext({ baseURL, javaScriptEnabled: false })
  try {
    const page = await context.newPage()
    await page.goto('/gallery')
    await expect(page.getByRole('heading', { name: '画廊', exact: true })).toBeVisible()
    await expect(page.locator('.gallery-item')).toHaveCount(12)
    await expect(page.locator('.gallery-item').first()).toContainText(sample.items[0].title)
  } finally {
    await context.close()
  }
})

test('更换作品图片释放自身引用并保留朋友圈共用文件', async ({ page, request }) => {
  const call = await api(request)
  const samples = (await call('/admin/gallery?pageSize=12')).items
  const original = samples[0],
    replacement = samples.find((photo: { mediaId: string }) => photo.mediaId !== original.mediaId)
  expect(replacement).toBeTruthy()
  const originalCount = (await call(`/admin/media/${original.mediaId}/references`)).total
  const replacementCount = (await call(`/admin/media/${replacement.mediaId}/references`)).total
  const moment = await call('/admin/moments', 'POST', {
    requestId: randomUUID(),
    content: '与作品共享同一幅光影',
    images: [original.src],
    status: 'draft',
  })
  const photo = await call('/admin/gallery', 'POST', {
    requestId: randomUUID(),
    mediaId: original.mediaId,
    title: `共享的光影 ${randomUUID()}`,
    status: 'draft',
  })
  await login(page)
  await page.goto(`/admin/gallery/${photo.id}`)
  await page.getByRole('button', { name: '选择或上传图片', exact: true }).click()
  const picker = page.getByRole('dialog', { name: '选择媒体图片', exact: true })
  const asset = (await call(`/admin/media?search=${replacement.mediaId}`)).items[0]
  await picker.getByRole('textbox', { name: '搜索媒体', exact: true }).fill(asset.name)
  await picker.getByRole('button', { name: '搜索', exact: true }).click()
  await picker
    .locator('.media-library__grid > li')
    .filter({ hasText: asset.name })
    .getByRole('button', { name: '使用此图片', exact: true })
    .click()
  await page.getByRole('button', { name: '保存作品', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('作品已保存')
  expect((await call(`/admin/media/${original.mediaId}/references`)).total).toBe(originalCount + 1)
  expect((await call(`/admin/media/${replacement.mediaId}/references`)).total).toBe(replacementCount + 1)
  const latest = await call(`/admin/gallery/${photo.id}`)
  await call(`/admin/gallery/${photo.id}?revision=${latest.revision}`, 'DELETE')
  expect((await call(`/admin/media/${replacement.mediaId}/references`)).total).toBe(replacementCount)
  expect((await request.get(original.src)).status()).toBe(200)
  expect((await call(`/admin/moments/${moment.id}`)).images).toContain(original.src)
  await call(`/admin/moments/${moment.id}?revision=${moment.revision}`, 'DELETE')
})

test('器材配置可维护，保存后公开侧栏使用同一份资料', async ({ page, request }) => {
  const call = await api(request),
    before = await call('/admin/gallery/settings')
  await login(page)
  await page.goto('/admin/gallery/settings')
  try {
    const names = page.getByRole('textbox', { name: /^器材名称 / })
    await expect(page.getByRole('button', { name: '添加器材', exact: true })).toBeEnabled()
    const count = await names.count()
    if (count === 12) await page.getByRole('button', { name: '移除器材 12', exact: true }).click()
    await page.getByRole('button', { name: '添加器材', exact: true }).click()
    await names.last().fill('随身相机')
    await page
      .getByRole('textbox', { name: /^器材介绍 / })
      .last()
      .fill('日常散步时随身携带。')
    await page.getByRole('button', { name: '保存器材资料', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('器材资料已保存')
    await page.reload()
    await expect(names.last()).toHaveValue('随身相机')
    const metadata = (await (await request.get('/api/v1/gallery/metadata')).json()).data
    expect(metadata.gear.at(-1)).toMatchObject({ name: '随身相机', description: '日常散步时随身携带。' })
  } finally {
    const latest = await call('/admin/gallery/settings')
    await call('/admin/gallery/settings', 'PATCH', { gear: before.gear, revision: latest.revision })
  }
})
test('第二页深链共享 SSR 详情并在接管后定位页码，首次水合不重复等待读取', async ({ page, request }) => {
  await publicSample(request)
  const photo = (await (await request.get('/api/v1/gallery?page=2')).json()).data.items[0]
  let browserReads = 0
  const hydrationErrors: string[] = []
  page.on('console', (message) => {
    if (/hydration/i.test(message.text())) hydrationErrors.push(message.text())
  })
  await page.route(`**/api/v1/gallery/${photo.id}*`, async (route) => {
    browserReads++
    await new Promise((resolve) => setTimeout(resolve, 1200))
    await route.continue()
  })
  await page.goto(`/gallery?photo=${photo.id}`)
  await expect(page.getByRole('dialog', { name: photo.title, exact: true })).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true })).toBeEnabled()
  await expect(page).toHaveURL(/page=2/)
  expect(browserReads).toBe(0)
  expect(hydrationErrors).toEqual([])
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
test('跨页切图后列表仍在读取时关闭，焦点在正确列表到达后归还作品', async ({ page, request }) => {
  const sample = await publicSample(request),
    last = sample.items[11]
  const second = (await (await request.get('/api/v1/gallery?page=2')).json()).data.items[0]
  let delayed = 0
  await page.goto('/gallery')
  await page.route('**/api/v1/gallery?*', async (route) => {
    if (new URL(route.request().url()).searchParams.get('page') === '2') {
      delayed++
      await new Promise((resolve) => setTimeout(resolve, 1600))
    }
    await route.continue()
  })
  const original = page.getByRole('button', { name: `查看照片：${last.title}`, exact: true })
  await original.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: '下一张', exact: true })).toBeEnabled()
  await dialog.getByRole('button', { name: '下一张', exact: true }).click()
  await expect(dialog).toHaveAttribute('aria-label', second.title)
  expect(delayed).toBe(1)
  await dialog.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.locator('.gallery-body')).toBeFocused()
  await expect(page.getByRole('button', { name: `查看照片：${second.title}`, exact: true })).toBeFocused()
})
for (const theme of ['nexus', 'aurora', 'dock']) {
  for (const width of [320, 390, 767, 768, 1023, 1024, 1279, 1280, 1439, 1440]) {
    test(`图库 ${theme}/${width} 分页分类 URL 灯箱键盘和焦点`, async ({
      page,
      context,
      request,
      baseURL,
    }, testInfo) => {
      await publicSample(request)
      await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: theme, url: baseURL! }])
      await page.setViewportSize({ width, height: 960 })
      await page.emulateMedia({ reducedMotion: width === 320 ? 'reduce' : 'no-preference' })
      await page.goto('/gallery')
      await expect(page.locator(`.theme-${theme}`)).toBeVisible()
      await expect(page.locator('.gallery-item')).toHaveCount(12)
      const compactInfo = page.locator('.gallery-mobile-info')
      const hasFixedSidebar = theme === 'nexus' ? width >= 1440 : theme === 'aurora' ? width >= 1280 : false
      if (hasFixedSidebar) {
        await expect(compactInfo).not.toBeVisible()
      } else {
        await expect(compactInfo).toBeVisible()
        await compactInfo.locator('summary').click()
      }
      await expect(page.locator('.gallery-stats:visible')).toHaveCount(1)
      await expect(page.locator('.gear-card:visible')).toHaveCount(1)
      await expect(page.getByRole('heading', { name: '画廊统计', exact: true })).toHaveCount(1)
      await expect(page.getByRole('heading', { name: '摄影器材', exact: true })).toHaveCount(1)
      if (theme === 'dock') await expect(page.locator('#right-sidebar-target .gallery-stats')).toHaveCount(0)
      if (!hasFixedSidebar) await compactInfo.locator('summary').click()
      const first = page.locator('.gallery-item').nth(6),
        originalTitle = await first.getAttribute('aria-label')
      await first.scrollIntoViewIfNeeded()
      const beforeLightbox = (await first.boundingBox())!.y
      await first.focus()
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(/photo=\d+/)
      const dialog = page.getByRole('dialog')
      await expect(dialog.getByRole('button', { name: '关闭', exact: true })).toBeFocused()
      await expect(dialog.getByRole('button', { name: '下一张', exact: true })).toBeEnabled()
      await page.keyboard.press('ArrowRight')
      await expect(dialog).not.toHaveAttribute('aria-label', originalTitle!.replace('查看照片：', ''))
      await expect(dialog.getByRole('button', { name: '上一张', exact: true })).toBeEnabled()
      await page.keyboard.press('ArrowLeft')
      await expect(dialog).toHaveAttribute('aria-label', originalTitle!.replace('查看照片：', ''))
      if ([390, 1440].includes(width)) await captureMotion(page, testInfo, `gallery-${theme}-${width}.png`)
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(first).toBeFocused()
      await expect.poll(async () => Math.abs((await first.boundingBox())!.y - beforeLightbox)).toBeLessThan(2)
      await page
        .getByRole('navigation', { name: '图库分页', exact: true })
        .getByRole('button', { name: '下一页', exact: true })
        .click()
      await expect(page).toHaveURL(/page=2/)
      await page.reload()
      await expect(page).toHaveURL(/page=2/)
      await page.goBack()
      await expect(page).not.toHaveURL(/page=2/)
      await page.goForward()
      await expect(page).toHaveURL(/page=2/)
      const category = page.locator('.gallery-filter button').nth(1)
      await category.click()
      await expect(page).toHaveURL(/category=/)
      await expect(category).toHaveAttribute('aria-pressed', 'true')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
      expect(await page.locator('[data-page-motion-clone]').count()).toBe(0)
    })
  }
}
