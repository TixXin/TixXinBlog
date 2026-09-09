/** @file guestbook-business.spec.ts @description 留言真实发送、恢复、回应、审核和跨主题滚动，写入仅在隔离服务执行 */
import { test, expect } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { prepareMotionCapture, captureMotion } from './motionScreenshot'
test.beforeEach(({ page, browserName }) => prepareMotionCapture(page, browserName))
async function login(page: Page) {
  await page.goto('/admin/login')
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill(process.env.E2E_USERNAME!)
  await page.getByRole('textbox', { name: '密码', exact: true }).fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/admin$/, { timeout: 18000 })
}
async function identify(page: Page) {
  const dialog = page.getByRole('dialog', { name: '填写评论身份', exact: true })
  await expect(dialog).toBeVisible()
  await dialog.getByPlaceholder('你的昵称', { exact: true }).fill('小林')
  await dialog.getByRole('button', { name: '确认身份', exact: true }).click()
}
async function adminApi(request: APIRequestContext) {
  const signed = await request.post('/api/v1/auth/login', {
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
  })
  expect(signed.status()).toBe(200)
  const token = (await signed.json()).data.accessToken
  return async (path: string, method = 'GET', data?: unknown) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await request.fetch('/api/v1' + path, {
        method,
        data,
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.status() === 429 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1100))
        continue
      }
      expect(response.status()).toBeLessThan(300)
      return (await response.json()).data
    }
  }
}
test('访客未知发送结果重试不重复，另一上下文和刷新读取一致', async ({ page, request, browser, baseURL }) => {
  const content = '一次留下来的留言 ' + randomUUID()
  await page.goto('/guestbook')
  await expect(page.getByRole('button', { name: '添加回应', exact: true }).first()).toBeEnabled()
  const input = page.getByRole('textbox', { name: '留言内容', exact: true })
  await input.fill(content)
  let attempts = 0
  await page.route('**/api/v1/guestbook', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    const response = await route.fetch()
    if (++attempts === 1) return route.abort('failed')
    await route.fulfill({ response })
  })
  await page.getByRole('button', { name: '发送留言', exact: true }).click()
  await identify(page)
  await expect(page.locator('.message-input [role="alert"]')).toBeVisible()
  await expect(input).toHaveValue(content)
  await page.getByRole('button', { name: '发送留言', exact: true }).click()
  await expect(input).toHaveValue('')
  await expect(page.locator('.message-bubble__content').filter({ hasText: content })).toHaveCount(1)
  expect((await (await request.get('/api/v1/guestbook?q=' + encodeURIComponent(content))).json()).data.total).toBe(1)
  await page.reload()
  await expect(page.locator('.message-bubble__content').filter({ hasText: content })).toHaveCount(1)
  const other = await browser.newContext({ baseURL })
  try {
    const view = await other.newPage()
    await view.goto('/guestbook?q=' + encodeURIComponent(content))
    await expect(view.locator('.message-bubble__content')).toHaveText(content)
  } finally {
    await other.close()
  }
})
test('真实回复和回应持久化，隐藏父留言不泄露引用', async ({ page, request }) => {
  const call = await adminApi(request),
    key = randomUUID()
  const parent = await call('/admin/guestbook', 'POST', { content: '父留言正文 ' + key, requestId: randomUUID() })
  await page.goto('/guestbook?q=' + key)
  await expect(page.getByRole('button', { name: '添加回应', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '添加回应', exact: true }).click()
  await page
    .getByRole('group', { name: '选择回应', exact: true })
    .getByRole('button', { name: '赞', exact: true })
    .click()
  await expect(page.getByRole('button', { name: '赞，1 次回应', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: /回复.*的留言/ }).click()
  await page.getByRole('textbox', { name: '留言内容', exact: true }).fill('子回复内容 ' + key)
  await page.getByRole('button', { name: '发送留言', exact: true }).click()
  await identify(page)
  await expect(page.getByRole('textbox', { name: '留言内容', exact: true })).toHaveValue('')
  await page.reload()
  await expect(page.getByRole('button', { name: '赞，1 次回应', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await call(`/admin/guestbook/${parent.id}`, 'PATCH', { status: 'hidden', revision: parent.revision })
  await page.reload()
  await expect(page.locator('.message-bubble')).toHaveCount(1)
  await expect(page.locator('.message-bubble')).toContainText('所引用的留言暂不可见')
  await expect(page.locator('.message-bubble')).not.toContainText('父留言正文')
})
test('后台审核置顶回复删除与公开状态一致', async ({ page, request }) => {
  const call = await adminApi(request),
    key = randomUUID()
  const note = await call('/admin/guestbook', 'POST', { content: '管理留言 ' + key, requestId: randomUUID() })
  await call(`/admin/guestbook/${note.id}`, 'PATCH', { status: 'pending', revision: note.revision })
  await login(page)
  await page.goto('/admin/guestbook?q=' + key)
  const row = page.locator(`[data-admin-guestbook-id="${note.id}"]`)
  const detailTrigger = row.getByRole('button', { name: '查看留言', exact: true })
  await detailTrigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: '留言详情', exact: true })).toBeFocused()
  await page.getByRole('button', { name: '关闭详情', exact: true }).click()
  await expect(detailTrigger).toBeFocused()
  await expect(row.getByRole('button', { name: '回复留言', exact: true })).toBeDisabled()
  await row.getByRole('button', { name: '公开留言', exact: true }).click()
  await expect(row.locator('p').first()).toContainText('已公开')
  await row.getByRole('button', { name: '置顶留言', exact: true }).click()
  await expect(row.locator('p').first()).toContainText('· 置顶')
  expect((await (await request.get('/api/v1/guestbook/metadata')).json()).data.pinned.id).toBe(note.id)
  await row.getByRole('button', { name: '回复留言', exact: true }).click()
  await page.getByRole('textbox', { name: '留言内容', exact: true }).fill('博主答复 ' + key)
  await page.getByRole('button', { name: '发送留言', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '留言内容', exact: true })).toHaveValue('')
  await expect(page.locator('.admin-guestbook__list > li')).toHaveCount(2)
  page.once('dialog', (dialog) => dialog.accept())
  await row.getByRole('button', { name: '删除留言', exact: true }).click()
  await expect(row).toHaveCount(0)
  expect((await request.get(`/api/v1/guestbook/${note.id}`)).status()).toBe(404)
})
test('迟到成功不清除新输入，刷新后可恢复未发送内容', async ({ page }) => {
  await login(page)
  await page.goto('/guestbook')
  const input = page.getByRole('textbox', { name: '留言内容', exact: true })
  await input.fill('先发送的正文 ' + randomUUID())
  await page.route('**/api/v1/admin/guestbook', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    const response = await route.fetch()
    await new Promise((resolve) => setTimeout(resolve, 600))
    await route.fulfill({ response })
  })
  await page.getByRole('button', { name: '发送留言', exact: true }).click()
  await input.fill('仍然在编写的下一条留言')
  await expect(page.locator('.message-input [role="status"]')).toContainText('留言已发送')
  await expect(input).toHaveValue('仍然在编写的下一条留言')
  page.once('dialog', (dialog) => dialog.accept())
  await page.reload()
  await page.getByRole('button', { name: '恢复输入', exact: true }).click()
  await expect(input).toHaveValue('仍然在编写的下一条留言')
  await input.fill('')
})
test('首次客户端读取失败不显示空态，重试恢复真实列表', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/app-client-ready/)
  let failed = true
  await page.route('**/api/v1/guestbook?**', (route) =>
    failed ? route.fulfill({ status: 503, json: { code: 503, message: '暂不可用' } }) : route.continue(),
  )
  await page.getByRole('link', { name: '留言', exact: true }).click()
  await expect(page.locator('.guestbook-feedback [role="alert"]')).toBeVisible()
  await expect(page.locator('.guestbook-empty')).toHaveCount(0)
  failed = false
  await page.locator('.guestbook-feedback').getByRole('button', { name: '重试', exact: true }).click()
  await expect(page.locator('.message-bubble').first()).toBeVisible()
})

test('统计失败显示未知而非零，重试与实际公开聚合一致', async ({ page, request }) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/app-client-ready/)
  let failed = true
  await page.route('**/api/v1/guestbook/metadata', (route) =>
    failed ? route.fulfill({ status: 503, json: { code: 503, message: '统计暂不可用' } }) : route.continue(),
  )
  await page.getByRole('link', { name: '留言', exact: true }).click()
  const overview = page.locator('.guestbook-overview:visible')
  await expect(overview.getByRole('alert')).toBeVisible()
  await expect(page.locator('.page-title__sub')).toHaveText('— 条公开留言')
  await expect(page.locator('.message-bubble').first()).toBeVisible()
  failed = false
  await overview.getByRole('button', { name: '重试', exact: true }).click()
  const total = (await (await request.get('/api/v1/guestbook/metadata')).json()).data.stats.messages
  await expect(page.locator('.page-title__sub')).toHaveText(`${total} 条公开留言`)
  await expect(overview.getByRole('alert')).toHaveCount(0)
})

test('迟到搜索、跨页往返和减少动态效果保留当前查询及草稿', async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const call = await adminApi(request),
    first = randomUUID(),
    second = randomUUID()
  await call('/admin/guestbook', 'POST', { content: '山间的风 ' + first, requestId: randomUUID() })
  await call('/admin/guestbook', 'POST', { content: '林间的光 ' + second, requestId: randomUUID() })
  await page.goto('/guestbook')
  await expect(page.getByRole('button', { name: '添加回应', exact: true }).first()).toBeEnabled()
  const draft = page.getByRole('textbox', { name: '留言内容', exact: true })
  await draft.fill('搜索时继续写的草稿')
  let release!: () => void, started!: () => void
  const gate = new Promise<void>((resolve) => {
      release = resolve
    }),
    pending = new Promise<void>((resolve) => {
      started = resolve
    })
  await page.route('**/api/v1/guestbook?**', async (route) => {
    if (new URL(route.request().url()).searchParams.get('q') !== first) return route.continue()
    const response = await route.fetch()
    started()
    await gate
    await route.fulfill({ response }).catch(() => undefined)
  })
  const search = page.getByRole('textbox', { name: '搜索留言', exact: true })
  await search.fill(first)
  await pending
  await search.fill(second)
  await expect(page.locator('.message-bubble__content')).toHaveText(['林间的光 ' + second])
  release()
  await expect(page).toHaveURL(new RegExp('q=' + second))
  await expect(draft).toHaveValue('搜索时继续写的草稿')
  await page.getByRole('link', { name: '项目', exact: true }).click()
  await expect(page).toHaveURL(/\/projects/)
  await page.goBack()
  await expect(page).toHaveURL(new RegExp('guestbook\\?q=' + second))
  await expect(page.locator('.message-bubble__content')).toHaveText(['林间的光 ' + second])
  await expect(draft).toHaveValue('搜索时继续写的草稿')
  await expect(page.locator('[data-page-motion-overlay]')).toHaveCount(0)
  await draft.fill('')
})

test('运行中切换主题和关键断点，输入与侧栏归属保持且抽屉焦点返回', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  await page.goto('/guestbook')
  const draft = page.getByRole('textbox', { name: '留言内容', exact: true })
  await draft.fill('主题切换中的草稿')
  for (const theme of ['aurora', 'dock', 'nexus']) {
    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.getByRole('button', { name: '界面设置', exact: true }).click()
    await page
      .getByRole('dialog', { name: '界面设置', exact: true })
      .getByRole('button', { name: new RegExp(`^${theme} .*布局主题$`, 'i') })
      .click()
    await expect(page.locator(`.theme-${theme}`)).toBeVisible()
    for (const width of [1023, 1024, 1279, 1280, 1439, 1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 })
      await expect(draft).toHaveValue('主题切换中的草稿')
      await expect(page.locator('.guestbook-center')).toHaveAttribute(
        'data-display-mode',
        theme === 'nexus' && width >= 1024 ? 'chat' : 'forum',
      )
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const fixed = theme === 'nexus' ? width >= 1440 : theme === 'aurora' && width >= 1280
      await expect(page.locator('.guestbook-overview:visible')).toHaveCount(fixed ? 1 : 0)
      if (!fixed) {
        const trigger = page.getByRole('button', { name: '留言信息', exact: true })
        await trigger.focus()
        await page.keyboard.press('Enter')
        await expect(page.getByRole('dialog', { name: '留言信息', exact: true })).toBeVisible()
        await expect(page.locator('.guestbook-overview:visible')).toHaveCount(1)
        await page.keyboard.press('Escape')
        await expect(trigger).toBeFocused()
      }
    }
  }
  await draft.fill('')
})

test('脚本接管前不接受丢失的输入，登录恢复期间仍可编写', async ({ page }) => {
  let scriptsReady!: () => void, authReady!: () => void, authStarted!: () => void
  const scriptGate = new Promise<void>((resolve) => {
      scriptsReady = resolve
    }),
    authGate = new Promise<void>((resolve) => {
      authReady = resolve
    })
  const authPending = new Promise<void>((resolve) => {
    authStarted = resolve
  })
  await page.route('**/_nuxt/**', async (route) => {
    if (route.request().resourceType() === 'script') await scriptGate
    await route.continue()
  })
  await page.route('**/api/v1/auth/session', async (route) => {
    authStarted()
    await authGate
    await route.continue()
  })
  await page.goto('/guestbook', { waitUntil: 'commit' })
  const draft = page.getByRole('textbox', { name: '留言内容', exact: true })
  await expect(draft).toBeDisabled()
  scriptsReady()
  await expect(draft).toBeEnabled()
  await draft.fill('登录确认之前写下的内容')
  await authPending
  await expect(page.locator('.message-input__footer small')).toHaveText('11 / 500')
  await expect(page.getByRole('button', { name: '发送留言', exact: true })).toBeDisabled()
  authReady()
  await expect(page.getByRole('button', { name: '发送留言', exact: true })).toBeEnabled()
  await expect(draft).toHaveValue('登录确认之前写下的内容')
  await draft.fill('')
})
for (const theme of ['nexus', 'aurora', 'dock'])
  test(`留言布局 ${theme} 历史加载和手机输入保持`, async ({ page, context, baseURL }, testInfo) => {
    await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: theme, url: baseURL! }])
    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.goto('/guestbook')
    await expect(page.getByRole('button', { name: '添加回应', exact: true }).first()).toBeEnabled()
    if (theme === 'nexus') {
      await expect(page.locator('.message-bubble').last()).toBeInViewport({ ratio: 0.8 })
      await page.locator('.guestbook-viewport').evaluate((node) => {
        node.scrollTop = 0
      })
      await expect.poll(() => page.locator('.message-bubble').count()).toBeGreaterThan(20)
    } else {
      // 滚动进入视口会自动追加，按钮可能随最后一页消失；验证真实滚动路径。
      await page.getByRole('button', { name: '加载更多留言', exact: true }).scrollIntoViewIfNeeded()
      await expect.poll(() => page.locator('.message-bubble').count()).toBeGreaterThan(20)
    }
    const ids = await page
      .locator('.message-bubble')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-guestbook-id')))
    expect(new Set(ids).size).toBe(ids.length)
    await page.getByRole('textbox', { name: '留言内容', exact: true }).fill('切换尺寸仍保留的输入')
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 1000 })
      await expect(page.getByRole('textbox', { name: '留言内容', exact: true })).toHaveValue('切换尺寸仍保留的输入')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.getByRole('button', { name: '留言信息', exact: true }).click()
      await expect(page.getByRole('dialog', { name: '留言信息' }).locator('.chat-stats')).toHaveCount(1)
      await page.keyboard.press('Escape')
    }
    await page.getByRole('textbox', { name: '留言内容', exact: true }).fill('')
    await captureMotion(page, testInfo, `${theme}-guestbook-mobile.png`)
  })

for (const theme of ['nexus', 'aurora', 'dock'])
  test(`历史追加 ${theme} 保留实际可见留言锚点，失败可原游标重试`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: theme, url: baseURL! }])
    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.goto('/guestbook')
    await expect(page.getByRole('button', { name: '添加回应', exact: true }).first()).toBeEnabled()
    const initial = await page.locator('.message-bubble').count()
    let calls = 0,
      release!: () => void,
      started!: () => void
    const waiting = new Promise<void>((resolve) => {
      started = resolve
    })
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const cursors: string[] = []
    await page.route('**/api/v1/guestbook?**', async (route) => {
      const before = new URL(route.request().url()).searchParams.get('before')
      if (!before) return route.continue()
      cursors.push(before)
      if (++calls === 1) return route.fulfill({ status: 503, json: { code: 503, message: '历史读取暂不可用' } })
      if (calls === 2) {
        started()
        await gate
      }
      await route.continue()
    })
    if (theme === 'nexus')
      await page.locator('.guestbook-viewport').evaluate((node) => {
        node.scrollTop = 0
      })
    else await page.getByRole('button', { name: '加载更多留言', exact: true }).scrollIntoViewIfNeeded()
    await expect(page.locator('.guestbook-more [role="alert"]')).toBeVisible()
    expect(await page.locator('.message-bubble').count()).toBe(initial)
    await page.getByRole('button', { name: theme === 'nexus' ? '重试加载历史' : '重试加载更多', exact: true }).click()
    await waiting
    const anchor = await page.locator('.guestbook-viewport').evaluate((node) => {
      let root: HTMLElement | null = node as HTMLElement
      while (
        root &&
        root !== document.body &&
        !(/(auto|scroll)/.test(getComputedStyle(root).overflowY) && root.scrollHeight > root.clientHeight + 1)
      )
        root = root.parentElement
      const bounds = root && root !== document.body ? root.getBoundingClientRect() : { top: 0, bottom: innerHeight }
      const first = [...node.querySelectorAll<HTMLElement>('[data-guestbook-id]')].find((item) => {
        const box = item.getBoundingClientRect()
        return box.bottom > Math.max(0, bounds.top) && box.top < bounds.bottom
      })!
      return { id: first.dataset.guestbookId!, top: first.getBoundingClientRect().top }
    })
    release()
    await expect.poll(() => page.locator('.message-bubble').count()).toBeGreaterThan(initial)
    expect(cursors[1]).toBe(cursors[0])
    await expect
      .poll(async () =>
        Math.abs((await page.locator(`[data-guestbook-id="${anchor.id}"]`).boundingBox())!.y - anchor.top),
      )
      .toBeLessThan(3)
  })
