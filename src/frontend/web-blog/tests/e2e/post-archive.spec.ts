/** @file post-archive.spec.ts @description 真实后端归档分页、年份URL与失败恢复，页面只保留50条时间线 */
import { expect, test } from '@playwright/test'
import { prepareMotionCapture } from './motionScreenshot'

test.beforeEach(({ page, browserName }) => prepareMotionCapture(page, browserName))

test('归档深链按50条分页，历史恢复与年份筛选保持URL一致', async ({ page, request }) => {
  const response = await request.get('/api/v1/posts/archive?page=2')
  expect(response.ok()).toBe(true)
  const second = (await response.json()).data
  const thirdResponse = await request.get('/api/v1/posts/archive?page=3')
  expect(thirdResponse.ok()).toBe(true)
  const third = (await thirdResponse.json()).data
  const hydration: string[] = []
  page.on('console', (message) => {
    if (/hydration.*mismatch/i.test(message.text())) hydration.push(message.text())
  })
  await page.goto('/archive?page=2')
  await expect(page.locator('.archive-item')).toHaveCount(second.items.length)
  await expect(page.locator('.archive-item__title').first()).toHaveText(second.items[0].title)
  const pager = page.getByRole('navigation', { name: '文章归档分页' })
  await pager.getByRole('button', { name: '下一页', exact: true }).click()
  await expect(page).toHaveURL(/\/archive\?page=3$/)
  await expect(page.locator('.archive-item')).toHaveCount(third.items.length)
  await expect(page.locator('.archive-item__title').first()).toHaveText(third.items[0].title)
  expect(await page.locator('.archive-item').count()).toBeLessThanOrEqual(50)
  await page.goBack()
  await expect(page).toHaveURL(/\/archive\?page=2$/)
  await expect(page.locator('.archive-item__title').first()).toHaveText(second.items[0].title)
  const year = String(second.years[0].year)
  await page.getByRole('combobox', { name: '归档年份' }).selectOption(year)
  await expect(page).toHaveURL(new RegExp(`/archive\\?year=${year}$`))
  await expect(page.locator('.archive-timeline__title')).toHaveText(`${year} 年`)
  await expect(page.locator('.archive-item')).toHaveCount(50)
  expect(hydration).toEqual([])
})

test('切页失败保留上次成功页并标明来源，重试恢复真实页面', async ({ page }) => {
  await page.goto('/archive')
  await expect(page.locator('.archive-item')).toHaveCount(50)
  const previousTitles = await page.locator('.archive-item__title').allTextContents()
  let failed = false
  await page.route('**/api/v1/posts/archive?*', async (route) => {
    if (!failed && new URL(route.request().url()).searchParams.get('page') === '2') {
      failed = true
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: '归档读取暂不可用' }),
      })
    } else await route.continue()
  })
  await page.getByRole('navigation', { name: '文章归档分页' }).getByRole('button', { name: '下一页' }).click()
  await expect(page.getByText('归档加载失败，请稍后重试', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.locator('.archive-item')).toHaveCount(50)
  await expect(page.locator('.archive-item__title')).toHaveText(previousTitles)
  await expect(page.locator('.archive-stale-notice')).toContainText('上次成功结果')
  const pagination = page.getByRole('navigation', { name: '文章归档分页' })
  await expect(pagination).toContainText('1 /')
  await expect(pagination.getByRole('button', { name: '上一页' })).toBeDisabled()
  await expect(pagination.getByRole('button', { name: '下一页' })).toBeDisabled()
  await page.locator('.archive-body').getByRole('button', { name: /重试/ }).click()
  await expect(page.locator('.archive-item')).toHaveCount(50)
  await expect(page.locator('.archive-stale-notice')).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: '文章归档分页' })).toContainText('2 /')
})

for (const theme of ['nexus', 'aurora', 'dock']) {
  test(`${theme} 窄屏年份筛选和分页可用且不横向溢出`, async ({ page, context, baseURL }, testInfo) => {
    await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: theme, url: baseURL! }])
    await context.addInitScript(
      (mode) => localStorage.setItem('nuxt-color-mode', mode),
      theme === 'aurora' ? 'light' : 'dark',
    )
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme: theme === 'aurora' ? 'light' : 'dark', reducedMotion: 'reduce' })
    await page.goto('/archive')
    await expect(page.locator('.archive-item')).toHaveCount(50)
    const years = page.getByRole('combobox', { name: '归档年份' })
    await expect(years).toBeVisible()
    await years.selectOption({ index: 1 })
    await expect(page).toHaveURL(/year=\d{4}/)
    await expect(page.locator('.archive-item')).toHaveCount(50)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`${theme}-archive-mobile.png`) })
    const next = page.getByRole('navigation', { name: '文章归档分页' }).getByRole('button', { name: '下一页' })
    await next.click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.locator('.archive-item')).toHaveCount(50)
  })
}
