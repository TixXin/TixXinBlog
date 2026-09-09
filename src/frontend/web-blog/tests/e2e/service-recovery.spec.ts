/**
 * @file service-recovery.spec.ts
 * @description 隔离服务上的首次失败、慢重试、闪念草稿保护和归档箱恢复
 */
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { captureMotion, prepareMotionCapture } from './motionScreenshot'

test.beforeEach(({ page, browserName }) => {
  expect(process.env.E2E_ISOLATED).toBe('true')
  prepareMotionCapture(page, browserName)
})

test.beforeAll(async ({ request }) => {
  expect(process.env.E2E_ISOLATED).toBe('true')
  const session = await request.post('/api/v1/auth/login', {
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
  })
  expect(session.ok()).toBe(true)
  const token = (await session.json()).data.accessToken
  const response = await request.post('/api/v1/admin/flashes', {
    headers: { Authorization: `Bearer ${token}` },
    data: { content: '服务恢复验收的公开闪念', tags: ['恢复验收'], type: 'idea', images: [] },
  })
  expect(response.ok()).toBe(true)
})

async function login(page: Page) {
  const response = await page.request.post('/api/v1/auth/login', {
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
  })
  expect(response.ok()).toBe(true)
}
const unavailable = {
  status: 502,
  contentType: 'application/json',
  body: JSON.stringify({ message: 'upstream details' }),
}

for (const theme of ['nexus', 'aurora', 'dock']) {
  test.describe(theme, () => {
    test.beforeEach(async ({ context, baseURL, page }) => {
      await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: theme, url: baseURL! }])
      await page.setViewportSize({ width: 1440, height: 1000 })
    })

    test('文章首次失败可键盘重试，慢请求期间保留标题', async ({ page }) => {
      await page.goto('/about')
      let fail = true
      let release: (() => void) | undefined
      await page.route('**/api/v1/posts?**', async (route) => {
        if (fail) return route.fulfill(unavailable)
        await new Promise<void>((resolve) => {
          release = resolve
        })
        await route.continue()
      })
      await page.locator('a[href="/"]:visible').first().click()
      const feedback = page.locator('.post-card-list-root .request-feedback')
      await expect(feedback).toContainText('文章加载失败')
      await expect(page.getByText('暂无相关文章', { exact: true })).toHaveCount(0)
      const header = page.locator('.articles-page .main-content__header')
      const before = await header.boundingBox()
      fail = false
      const retry = feedback.getByRole('button')
      await retry.press('Enter')
      await expect(retry).toHaveAttribute('aria-disabled', 'true')
      await expect(retry).toBeFocused()
      await expect(header).toBeVisible()
      expect((await header.boundingBox())?.y).toBe(before?.y)
      await expect.poll(() => !!release).toBe(true)
      release!()
      await expect(page.locator('.post-list .post-item').first()).toBeVisible()
      await expect(feedback).toHaveCount(0)
    })

    test('公开闪念失败不是空列表，手机与桌面重试后仍能筛选', async ({ page, browserName }, testInfo) => {
      let fail = true
      await page.route('**/api/v1/flashes?**', (route) => (fail ? route.fulfill(unavailable) : route.continue()))
      await page.goto('/flash')
      const feedback = page.locator('.flash-note-list .request-feedback')
      await expect(feedback).toContainText('闪念服务暂时不可用')
      await expect(page.locator('.flash-note-list__empty')).toHaveCount(0)
      await expect(page.locator('.flash-stat-card__value').first()).toHaveText('—')
      await expect(page.locator('.flash-page')).not.toContainText('/api/v1/')
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 1000 })
        await expect(feedback.getByRole('button', { name: '重试', exact: true })).toBeVisible()
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
      }
      if (browserName === 'chromium') await captureMotion(page, testInfo, `${theme}-flash-failure.png`)
      fail = false
      await feedback.getByRole('button', { name: '重试', exact: true }).click()
      await expect(page.locator('.fnc').first()).toBeVisible()
      await expect(feedback).toHaveCount(0)
      await page.getByRole('button', { name: '搜索闪念', exact: true }).click()
      await page.getByRole('textbox', { name: '搜索闪念内容或标签' }).fill('不存在的回归筛选词-94117')
      await expect(page.locator('.flash-note-list__empty')).toHaveText('没有匹配的闪念，请调整筛选条件')
    })

    test('管理闪念读取与发布失败都显示可读提示并保留编辑草稿', async ({ page }) => {
      await login(page)
      let failRead = true
      let writes = 0
      await page.route('**/api/v1/admin/flashes**', (route) => {
        if (route.request().method() === 'POST') {
          writes++
          return route.fulfill(unavailable)
        }
        return failRead ? route.fulfill(unavailable) : route.continue()
      })
      await page.goto('/flash')
      const editor = page.getByRole('textbox', { name: '闪念正文', exact: true })
      await expect(editor).toBeVisible()
      const feedback = page.locator('.flash-note-list .request-feedback')
      await expect(feedback).toContainText('闪念服务暂时不可用')
      await editor.fill('读取与发布失败时必须保留的草稿')
      failRead = false
      await feedback.getByRole('button', { name: '重试', exact: true }).click()
      await expect(page.locator('.fnc').first()).toBeVisible()
      await expect(editor).toHaveValue('读取与发布失败时必须保留的草稿')
      await page.getByRole('button', { name: /^发布/ }).click()
      await expect(page.locator('.toast-container')).toContainText('闪念服务暂时不可用')
      await expect(editor).toHaveValue('读取与发布失败时必须保留的草稿')
      expect(writes).toBe(1)
      await expect(page.locator('body')).not.toContainText('[POST]')
    })

    test('归档箱失败可重试，快速往返不覆盖主列表和草稿', async ({ page }) => {
      await login(page)
      await page.goto('/flash')
      await expect(page.locator('.fnc').first()).toBeVisible()
      const editor = page.getByRole('textbox', { name: '闪念正文', exact: true })
      await editor.fill('归档箱往返保留草稿')
      let fail = true
      await page.route('**/api/v1/admin/flashes?**', (route) => {
        const archived = new URL(route.request().url()).searchParams.get('archived') === 'true'
        return archived && fail ? route.fulfill(unavailable) : route.continue()
      })
      await page.getByRole('button', { name: '查看归档箱', exact: true }).click()
      const feedback = page.locator('.flash-note-list .request-feedback')
      await expect(feedback).toContainText('闪念服务暂时不可用')
      await expect(page.locator('.flash-note-list__empty')).toHaveCount(0)
      await page.getByRole('button', { name: '返回主列表', exact: true }).click()
      await expect(page.locator('.fnc').first()).toBeVisible()
      await page.getByRole('button', { name: '查看归档箱', exact: true }).click()
      await expect(feedback).toContainText('闪念服务暂时不可用')
      fail = false
      await feedback.getByRole('button', { name: '重试', exact: true }).click()
      await expect(feedback).toHaveCount(0)
      await expect(
        page
          .locator('.fnc')
          .first()
          .or(page.getByText('归档箱暂无闪念', { exact: true })),
      ).toBeVisible()
      await expect(editor).toHaveValue('归档箱往返保留草稿')
      await page.getByRole('button', { name: '返回主列表', exact: true }).click()
      await expect(page.locator('.fnc').first()).toBeVisible()
    })
  })
}
