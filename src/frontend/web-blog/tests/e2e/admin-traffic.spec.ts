/** @file admin-traffic.spec.ts @description 隔离库中验收后台访问统计：访客落地来源与页面计入，博主查看趋势、排行、地区地图与范围切换，近期访问的开关、打码明细与关闭清空 */
import { expect, test } from '@playwright/test'

// 无头 Chromium 的 User-Agent 含 HeadlessChrome，会被当作自动化客户端不计浏览；这里模拟普通桌面浏览器。
const DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

test.beforeEach(() => {
  expect(process.env.E2E_ISOLATED).toBe('true')
})

test('访客从站外来源进入后，后台访问统计显示来源、热门页面与设备，切换范围后趋势按天数补齐', async ({ browser }) => {
  const visitor = await (await browser.newContext({ userAgent: DESKTOP })).newPage()
  const heartbeat = visitor.waitForResponse(
    (response) => response.url().endsWith('/api/v1/presence') && response.request().postDataJSON()?.view === true,
  )
  await visitor.goto('/links', { referer: 'https://www.example.org/some/path?q=1' })
  const sent = (await heartbeat).request().postDataJSON()
  expect(sent).toMatchObject({ path: '/links', view: true, referrer: 'www.example.org' })
  await visitor.context().close()

  const owner = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  await owner.goto('/admin/login')
  await owner.getByRole('textbox', { name: '用户名', exact: true }).fill(process.env.E2E_USERNAME!)
  await owner.getByRole('textbox', { name: '密码', exact: true }).fill(process.env.E2E_PASSWORD!)
  await owner.getByRole('button', { name: '登录', exact: true }).click()
  await expect(owner).toHaveURL(/\/admin$/)
  await owner.getByRole('link', { name: '访问统计' }).first().click()
  await expect(owner).toHaveURL(/\/admin\/traffic$/)
  await expect(owner.getByRole('heading', { level: 1, name: '访问统计' })).toBeVisible()

  const ranking = (title: string) =>
    owner.locator('.traffic-ranking').filter({ has: owner.getByRole('heading', { name: title }) })
  await expect(ranking('来源')).toContainText('example.org')
  await expect(ranking('热门页面')).toContainText('/links')
  await expect(ranking('设备')).toContainText('桌面')
  await expect(ranking('浏览器')).toContainText('Chrome')
  const viewsTrend = owner.locator('.admin-traffic__trends section').first()
  await expect(viewsTrend.locator('.trend-bars__bar')).toHaveCount(30)

  const traffic = owner.waitForResponse((response) => response.url().includes('/admin/presence/traffic?days=7'))
  await owner.getByRole('button', { name: '近 7 天' }).click()
  expect((await traffic).ok()).toBe(true)
  await expect(owner.getByRole('button', { name: '近 7 天' })).toHaveAttribute('aria-pressed', 'true')
  await expect(viewsTrend.locator('.trend-bars__bar')).toHaveCount(7)

  // 地区：测试环境的访客地址是本机，地图照常渲染并说明未知地区的人数
  const map = owner.locator('.traffic-map')
  await expect(map.locator('[data-map-ready="true"]')).toBeVisible()
  await expect(map).toContainText('地区未知')
  await expect(ranking('地区排行')).toBeVisible()
  await owner.context().close()
})

test('近期访问默认关闭；开启后记录打码明细，博主本人的访问不记，关闭时确认并清空', async ({ browser }) => {
  const owner = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  await owner.goto('/admin/login')
  await owner.getByRole('textbox', { name: '用户名', exact: true }).fill(process.env.E2E_USERNAME!)
  await owner.getByRole('textbox', { name: '密码', exact: true }).fill(process.env.E2E_PASSWORD!)
  await owner.getByRole('button', { name: '登录', exact: true }).click()
  await expect(owner).toHaveURL(/\/admin$/)
  await owner.goto('/admin/traffic')
  const card = owner.locator('.traffic-visits')
  const toggle = card.getByRole('checkbox', { name: '记录近期访问' })
  await expect(toggle).not.toBeChecked()
  await expect(card.locator('table')).toHaveCount(0)
  await toggle.check()
  await expect(card).toContainText('开启后还没有新的访问')

  const visitor = await (await browser.newContext({ userAgent: DESKTOP })).newPage()
  const heartbeat = visitor.waitForResponse(
    (response) => response.url().endsWith('/api/v1/presence') && response.request().postDataJSON()?.view === true,
  )
  await visitor.goto('/projects')
  await heartbeat
  await visitor.context().close()

  await owner.getByRole('button', { name: '刷新' }).click()
  const row = card.locator('tbody tr').filter({ hasText: '/projects' })
  await expect(row).toHaveCount(1)
  // 地址只显示打码形式（IPv4 末段或 IPv6 后半段为 *）
  await expect(row.locator('td').nth(1)).toHaveText(/\*$/)
  await expect(row).toContainText('桌面 · Chrome')

  owner.once('dialog', (dialog) => void dialog.accept())
  await toggle.uncheck()
  await expect(toggle).not.toBeChecked()
  await expect(card.locator('table')).toHaveCount(0)
  await owner.reload()
  await expect(card.getByRole('checkbox', { name: '记录近期访问' })).not.toBeChecked()
  await owner.context().close()
})
