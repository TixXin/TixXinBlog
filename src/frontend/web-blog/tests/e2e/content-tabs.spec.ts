/**
 * @file content-tabs.spec.ts
 * @description 直接进入朋友圈和往返文章页时，内容导航保持相同布局与可访问选中状态
 */
import { test, expect } from '@playwright/test'
import { captureMotion } from './motionScreenshot'

for (const layout of ['nexus', 'aurora', 'dock']) {
  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    test(`内容导航 ${layout}/${width} 两页样式一致且可往返`, async ({ page, context, baseURL }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 })
      await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: layout, url: baseURL! }])
      const color = width === 390 || width === 1920 ? 'light' : 'dark'
      await context.addInitScript((value) => localStorage.setItem('nuxt-color-mode', value), color)
      await page.emulateMedia({
        colorScheme: width % 3 ? 'dark' : 'light',
        reducedMotion: width === 390 ? 'reduce' : 'no-preference',
      })
      // 首先直接进入朋友圈，不能依靠此前加载过文章页的样式。
      await page.goto('/moments')
      await expect(page.locator('html')).toHaveClass(/app-client-ready/)
      await expect(page.locator('html')).toHaveClass(new RegExp(color))
      await expect(page.locator('.loading-screen:visible')).toHaveCount(0)
      const nav = page.getByRole('navigation', { name: '内容类型' })
      async function geometry(active: string, root: string) {
        await expect(nav.getByRole('link', { name: active, exact: true })).toHaveAttribute('aria-current', 'page')
        await expect(nav.locator('[aria-current="page"]')).toHaveCount(1)
        await expect
          .poll(() =>
            page.locator(root).evaluate((el) => el.getAnimations().filter((a) => a.playState === 'running').length),
          )
          .toBe(0)
        const result = await nav.evaluate((el) => {
          const rect = el.getBoundingClientRect()
          return {
            display: getComputedStyle(el).display,
            x: rect.x,
            y: rect.y,
            height: rect.height,
            icon: !!el.parentElement?.querySelector('.page-title__icon-wrap'),
            links: [...el.querySelectorAll('a')].map((a) => {
              const box = a.getBoundingClientRect()
              return { x: box.x, right: box.right, width: box.width, height: box.height }
            }),
            width: innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
          }
        })
        expect(result.display).toBe('flex')
        expect(result.icon).toBe(true)
        expect(result.links[1]!.x - result.links[0]!.right).toBeGreaterThanOrEqual(16)
        expect(result.links.every((link) => link.height >= 44)).toBe(true)
        expect(result.scrollWidth).toBeLessThanOrEqual(result.width + 1)
        return result
      }
      const moments = await geometry('朋友圈', '.moments-page')
      await nav.getByRole('link', { name: '全部文章', exact: true }).click()
      await expect(page.locator('.articles-page')).toBeVisible()
      const articles = await geometry('全部文章', '.articles-page')
      expect(Math.abs(articles.x - moments.x)).toBeLessThan(1)
      expect(Math.abs(articles.y - moments.y)).toBeLessThan(1)
      expect(Math.abs(articles.height - moments.height)).toBeLessThan(1)
      await nav.getByRole('link', { name: '朋友圈', exact: true }).focus()
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(/\/moments$/)
      await geometry('朋友圈', '.moments-page')
      if ([390, 1440].includes(width)) await captureMotion(page, testInfo, `${layout}-${width}-content-tabs.png`)
      await page.goBack()
      await geometry('全部文章', '.articles-page')
      await page.goForward()
      await geometry('朋友圈', '.moments-page')
    })
  }
}
