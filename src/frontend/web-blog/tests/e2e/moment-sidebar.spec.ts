/** @file moment-sidebar.spec.ts @description 三主题各断点的朋友圈资料归属与紧凑抽屉回归 */
import { test, expect } from '@playwright/test'
import { prepareMotionCapture, captureMotion } from './motionScreenshot'

test.beforeEach(({ page, browserName }) => prepareMotionCapture(page, browserName))

test('运行中切换三套布局后资料归属更新，日期筛选保留', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/moments?date=2026-04-08')
  await expect(page.locator('html')).toHaveClass(/app-client-ready/)
  for (const theme of ['aurora', 'dock', 'nexus', 'dock', 'aurora', 'nexus']) {
    await page.getByRole('button', { name: '界面设置', exact: true }).click()
    await page
      .getByRole('dialog', { name: '界面设置', exact: true })
      .getByRole('button', { name: new RegExp(`^${theme} .*布局主题$`, 'i') })
      .click()
    await expect(page.locator(`.theme-${theme}`)).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(new URL(page.url()).searchParams.get('date')).toBe('2026-04-08')
    if (theme === 'dock') await page.getByRole('button', { name: '筛选动态', exact: true }).click()
    await expect(page.locator('.moment-author-card:visible')).toHaveCount(1)
    await expect(page.locator('.moment-calendar-card:visible .is-selected')).toHaveText('8')
    if (theme === 'dock') {
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
    }
  }
})

test('侧栏与抽屉共享日期话题筛选，重新挂载恢复已选月份', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/moments?date=2026-04-08&topic=技术分享')
  await expect(page.locator('html')).toHaveClass(/app-client-ready/)
  await expect(page.locator('.moment-calendar-card:visible .moment-calendar-card__month')).toHaveText('2026年4月')
  await expect(page.locator('.moment-calendar-card:visible .is-selected')).toHaveText('8')
  await page.setViewportSize({ width: 390, height: 1000 })
  await page.getByRole('button', { name: '筛选动态', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '筛选动态' })
  await expect(dialog.locator('.moment-calendar-card__month')).toHaveText('2026年4月')
  await expect(dialog.locator('.is-selected')).toHaveText('8')
  await dialog.locator('.is-selected').click()
  await expect.poll(() => new URL(page.url()).searchParams.get('date')).toBeNull()
  expect(new URL(page.url()).searchParams.get('topic')).toBe('技术分享')
  await dialog.locator('.moment-topic-card__item').filter({ hasText: '#生活日常' }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get('topic')).toBe('生活日常')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await expect(page.locator('.moment-calendar-card:visible .is-selected')).toHaveCount(0)
  await expect(page.locator('.moment-topic-card__item[aria-pressed="true"]:visible')).toContainText('生活日常')
})
for (const theme of ['nexus', 'aurora', 'dock']) {
  for (const kind of ['list', 'detail', 'topic']) {
    test(`朋友圈资料 ${theme}/${kind} 固定侧栏与抽屉不重复`, async ({ page, context, baseURL }, testInfo) => {
      await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: theme, url: baseURL! }])
      await page.goto('/moments')
      await expect(page.locator('html')).toHaveClass(/app-client-ready/)
      await expect(page.locator('.loading-screen:visible')).toHaveCount(0)
      if (kind === 'detail') {
        const href = await page
          .getByRole('link', { name: /^查看动态详情/ })
          .first()
          .getAttribute('href')
        expect(href).toBeTruthy()
        await page.goto(href!)
        await expect(page.locator('.moment-detail-page')).toBeVisible()
      } else if (kind === 'topic') await page.goto('/moments/topic/技术分享')
      const entry = page.getByRole('button', { name: kind === 'list' ? '筛选动态' : '动态信息', exact: true })
      for (const width of [320, 390, 1023, 1024, 1279, 1280, 1439, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 })
        const fixedInfo = theme === 'nexus' ? width >= 1024 : theme === 'aurora' && width >= 1280
        await expect(page.locator('.moment-author-card:visible')).toHaveCount(fixedInfo ? 1 : 0)
        await expect(page.locator('.moment-calendar-card:visible')).toHaveCount(fixedInfo ? 1 : 0)
        if (theme === 'nexus') await expect(page.locator('.aside-right .moment-author-card')).toHaveCount(0)
        if (await entry.isVisible()) {
          await entry.click()
          await expect(page.getByRole('dialog')).toBeVisible()
          await expect(page.locator('.moment-author-card:visible')).toHaveCount(1)
          await expect(page.locator('.moment-calendar-card:visible')).toHaveCount(1)
          if (width === 390 && kind === 'list') await captureMotion(page, testInfo, `${theme}-info-drawer.png`)
          await page.keyboard.press('Escape')
          await expect(page.getByRole('dialog')).toHaveCount(0)
          await expect(entry).toBeFocused()
        }
      }
      await page.setViewportSize({ width: 390, height: 1000 })
      await entry.click()
      await page.setViewportSize({ width: 1440, height: 1000 })
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(page.locator('#__nuxt[inert]')).toHaveCount(0)
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
      if (kind === 'list') await captureMotion(page, testInfo, `${theme}-sidebars.png`)
    })
  }
}
