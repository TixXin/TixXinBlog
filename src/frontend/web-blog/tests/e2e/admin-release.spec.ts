/**
 * @file admin-release.spec.ts
 * @description 后台版本标签与版本列表弹窗：显示当前版本与新版本提示，展开更新说明并复制升级命令。
 *   版本信息由前端服务查询 GitHub，测试在浏览器侧固定接口响应，不依赖外网
 * @author TixXin
 * @since 2026-11-06
 */
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { captureMotion, prepareMotionCapture } from './motionScreenshot'

test.beforeEach(({ page, browserName }) => prepareMotionCapture(page, browserName))

const summary = {
  current: '0.5.2-beta.6',
  channel: 'beta',
  latest: '0.5.2-beta.7',
  checkedAt: '2026-11-06T01:00:00Z',
  error: false,
  items: [
    {
      version: '0.5.2-beta.7',
      prerelease: true,
      publishedAt: '2026-11-06T00:30:00Z',
      url: 'https://github.com/TixXin/TixXinBlog/releases/tag/v0.5.2-beta.7',
      notes: '### 升级说明\n\n- 含一项数据库迁移：新增表\n\n### 新增\n\n- 后台显示版本号',
      migration: true,
      current: false,
      newer: true,
    },
    {
      version: '0.5.2-beta.6',
      prerelease: true,
      publishedAt: '2026-11-05T17:50:00Z',
      url: 'https://github.com/TixXin/TixXinBlog/releases/tag/v0.5.2-beta.6',
      notes: '### 变更\n\n- 友链页改版',
      migration: false,
      current: true,
      newer: false,
    },
  ],
}

async function login(page: Page) {
  await page.goto('/admin/login')
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill(process.env.E2E_USERNAME!)
  await page.getByRole('textbox', { name: '密码', exact: true }).fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/admin$/, { timeout: 18000 })
}

test('后台顶栏显示版本与新版本提示，弹窗列出版本并复制升级命令', async ({ page, context, browserName }, testInfo) => {
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.route('**/api/releases.json*', (route) => route.fulfill({ json: summary }))
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page)

  const badge = page.getByRole('button', { name: /当前版本 v0\.5\.2-beta\.6，有新版本 0\.5\.2-beta\.7/ })
  await expect(badge).toBeVisible()
  await expect(badge).toContainText('v0.5.2-beta.6')
  await expect(badge).toContainText('测试版')
  await expect(badge.locator('.release-badge__dot')).toBeVisible()

  await badge.click()
  const dialog = page.getByRole('dialog', { name: '版本与更新' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('status')).toHaveText('有新版本 v0.5.2-beta.7 可以升级。')
  const items = dialog.locator('.release-item')
  await expect(items).toHaveCount(2)
  await expect(items.nth(0)).toContainText('最新')
  await expect(items.nth(0)).toContainText('含数据库迁移')
  await expect(items.nth(1)).toContainText('当前')
  await expect(items.nth(0).getByRole('heading', { name: '新增' })).toBeVisible()
  await expect(items.nth(0).locator('code')).toHaveText('sudo tixxin update 0.5.2-beta.7')

  await items.nth(0).getByRole('button', { name: '复制' }).click()
  await expect(items.nth(0).getByRole('button', { name: '已复制' })).toBeVisible()
  if (browserName === 'chromium') {
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('sudo tixxin update 0.5.2-beta.7')
  }

  await captureMotion(page, testInfo, 'admin-release-dialog.png')

  // 展开当前版本只看说明，不给升级命令
  await items.nth(1).locator('summary').click()
  await expect(items.nth(1)).toContainText('友链页改版')
  await expect(items.nth(1).locator('code')).toHaveCount(0)

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('已是最新版本时不显示提示点', async ({ page }) => {
  const upToDate = { ...summary, latest: null, items: [{ ...summary.items[1]!, newer: false }] }
  await page.route('**/api/releases.json*', (route) => route.fulfill({ json: upToDate }))
  await login(page)
  const badge = page.getByRole('button', { name: '当前版本 v0.5.2-beta.6，查看版本列表' })
  await expect(badge).toBeVisible()
  await expect(badge.locator('.release-badge__dot')).toHaveCount(0)
  await badge.click()
  await expect(page.getByRole('dialog', { name: '版本与更新' }).getByRole('status')).toHaveText(
    '已是当前通道的最新版本。',
  )
})
