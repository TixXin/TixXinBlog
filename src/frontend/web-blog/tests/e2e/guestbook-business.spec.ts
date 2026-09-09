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
for (const theme of ['nexus', 'aurora', 'dock'])
  test(`留言布局 ${theme} 历史加载和手机输入保持`, async ({ page, context, baseURL }, testInfo) => {
    await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: theme, url: baseURL! }])
    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.goto('/guestbook')
    await expect(page.getByRole('button', { name: '添加回应', exact: true }).first()).toBeEnabled()
    if (theme === 'nexus') {
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
