/** @file live-presence.spec.ts @description 隔离库中验收实时在线与访问统计：底栏在线人数、统计卡访问统计、博主上线后访客看到在线、三主题页脚与公开统计开关 */
import { expect, test } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'

// 无头 Chromium 的 User-Agent 含 HeadlessChrome，会被当作自动化客户端不计入在线；这里模拟普通桌面浏览器。
const DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

test.beforeEach(() => {
  expect(process.env.E2E_ISOLATED).toBe('true')
})

async function visitor(browser: Browser, baseURL: string, theme: 'nexus' | 'aurora' | 'dock' = 'nexus') {
  const context = await browser.newContext({ userAgent: DESKTOP, viewport: { width: 1440, height: 900 } })
  await context.addCookies([{ name: 'blog-layout-theme', value: theme, url: baseURL }])
  return context.newPage()
}

/** 打开页面并等到第一次心跳返回，之后的断言基于心跳结果 */
async function openWithHeartbeat(page: Page, path: string) {
  const heartbeat = page.waitForResponse((response) => response.url().endsWith('/api/v1/presence') && response.ok())
  await page.goto(path)
  return (await (await heartbeat).json()).data
}

async function login(page: Page) {
  await page.goto('/admin/login')
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill(process.env.E2E_USERNAME!)
  await page.getByRole('textbox', { name: '密码', exact: true }).fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

test('访客看到在线人数与访问统计；博主上线前不显示状态，上线后访客看到“在线”', async ({ browser, baseURL }) => {
  const page = await visitor(browser, baseURL!)
  const first = await openWithHeartbeat(page, '/')
  expect(first.online).toBeGreaterThanOrEqual(1)
  expect(first.stats.todayViews).toBeGreaterThanOrEqual(1)
  await expect(page.locator('.nexus-bar__online')).toHaveText(/\d+ 人在线/)
  const live = page.locator('.stats-card__grid--live .stats-card__value')
  await expect(live).toHaveCount(3)
  await expect(live.nth(1)).toHaveText(String(first.stats.todayViews))
  // 新库博主从未在线、站点资料也没有手动状态：不展示“未提供在线状态”，状态行隐藏。
  expect(first.owner).toEqual({ status: 'away', lastSeenAt: null })
  await expect(page.locator('.owner-profile-card__status-line')).toHaveCount(0)
  await expect(page.getByText('未提供在线状态')).toHaveCount(0)

  const owner = await (await browser.newContext({ userAgent: DESKTOP })).newPage()
  await login(owner)
  // 访客站内跳转立即补发心跳，拿到博主在线状态。
  const heartbeat = page.waitForResponse((response) => response.url().endsWith('/api/v1/presence') && response.ok())
  await page.getByRole('navigation', { name: '站点导航' }).getByRole('link', { name: '归档', exact: true }).click()
  expect((await (await heartbeat).json()).data.owner.status).toBe('online')
  await page.goto('/')
  await expect(page.locator('.owner-profile-card__status-label')).toHaveText('在线')
  await expect(page.locator('.nexus-bar__presence-badge')).toContainText('在线')
  await page.context().close()
  await owner.context().close()
})

for (const theme of ['aurora', 'dock'] as const) {
  test(`${theme} 页脚显示在线人数`, async ({ browser, baseURL }) => {
    const page = await visitor(browser, baseURL!, theme)
    await openWithHeartbeat(page, '/')
    await expect(page.locator('.footer__online')).toHaveText(/\d+ 人在线/)
    await page.context().close()
  })
}

test('后台关闭公开统计后底栏与统计卡隐藏，重新开启后恢复', async ({ browser, baseURL, request }) => {
  const loginResponse = await request.post('/api/v1/auth/login', {
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
  })
  const token = (await loginResponse.json()).data.accessToken
  const save = (publicStats: boolean) =>
    request.patch('/api/v1/admin/presence', { data: { publicStats }, headers: { Authorization: `Bearer ${token}` } })
  expect((await save(false)).status()).toBe(200)
  try {
    // 后端开关有 10 秒缓存；关闭后等到心跳结果反映新设置。
    const page = await visitor(browser, baseURL!)
    await expect
      .poll(async () => (await openWithHeartbeat(page, '/')).stats, { timeout: 30_000, intervals: [2000] })
      .toBeNull()
    await expect(page.locator('.nexus-bar__online')).toHaveCount(0)
    await expect(page.locator('.stats-card__grid--live')).toHaveCount(0)
    await page.context().close()
  } finally {
    expect((await save(true)).status()).toBe(200)
  }
})
