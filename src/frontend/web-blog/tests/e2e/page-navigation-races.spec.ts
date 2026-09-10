/** @file page-navigation-races.spec.ts @description 精确验证触底取消与文章导航的竞争，以及重复打开设置后的焦点归还 */
import { expect, test } from '@playwright/test'
import type { Router } from 'vue-router'

interface RaceState {
  pageAttempts: number
  oldCancelled: number
  releaseOld?: () => void
  queuedSentinel?: () => void
  queueFlushed: boolean
}
declare global {
  interface Window {
    postNavigationRace: RaceState
  }
}
for (const layout of ['nexus', 'aurora', 'dock']) {
  test(`${layout}旧触底请求取消后不能把已进入的文章改回列表`, async ({ page, context, baseURL }, testInfo) => {
    await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: layout, url: baseURL! }])
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.addInitScript(() => {
      window.postNavigationRace = { pageAttempts: 0, oldCancelled: 0, queueFlushed: false }
      const NativeObserver = IntersectionObserver
      window.IntersectionObserver = class extends NativeObserver {
        constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
          super((entries, observer) => {
            const sentinel = entries.find(
              (entry) => entry.target.classList.contains('post-list__sentinel') && entry.isIntersecting,
            )
            if (sentinel) {
              // 保留真实相交事件，重现 disconnect 前已经排队、在旧导航取消后送达的回调。
              window.postNavigationRace.queuedSentinel = () => {
                window.postNavigationRace.queueFlushed = true
                callback([sentinel], observer)
              }
            }
            callback(entries, observer)
          }, options)
        }
      }
    })
    await page.goto('/?page=2&mode=continuous')
    await expect(page.locator('html')).toHaveClass(/app-client-ready/)
    const cards = page.locator('.post-list a[href^="/articles/"]')
    await expect(cards).toHaveCount(30)
    const href = await cards.last().getAttribute('href')
    expect(href).toMatch(/^\/articles\/\d+$/)
    const id = href!.split('/').at(-1)!
    const response = await page.request.get(`/api/v1/posts/${id}`)
    expect(response.status()).toBe(200)
    const title = (await response.json()).data.title as string
    // 唯一的第三页导航先等待用户点击；文章路由可提交，但详情读取仍在可观测的等待窗口中。
    await page.evaluate(() => {
      const root = document.getElementById('__nuxt') as HTMLElement & {
        __vue_app__: { config: { globalProperties: { $router: Router } } }
      }
      const router = root.__vue_app__.config.globalProperties.$router
      router.beforeEach((to) => {
        if (to.path !== '/' || to.query.page !== '3' || to.query.mode !== 'continuous') return
        const state = window.postNavigationRace
        state.pageAttempts++
        if (state.pageAttempts === 1) return new Promise<void>((resolve) => (state.releaseOld = resolve))
      })
      router.afterEach((to, _from, failure) => {
        if (to.path === '/' && to.query.page === '3' && failure?.type === 8) window.postNavigationRace.oldCancelled++
      })
    })
    let unblock!: () => void
    const detailGate = new Promise<void>((resolve) => (unblock = resolve))
    let detailBlocked = 0
    await page.route(`**/api/v1/posts/${id}`, async (route) => {
      detailBlocked++
      await detailGate
      await route.continue()
    })
    try {
      await cards.last().scrollIntoViewIfNeeded()
      await expect.poll(() => page.evaluate(() => window.postNavigationRace.pageAttempts)).toBe(1)
      await page.locator(`.post-list a[href="${href}"]`).click()
      await expect(page).toHaveURL(new RegExp(`${href}$`))
      await expect.poll(() => detailBlocked).toBe(1)
      await page.evaluate(() => window.postNavigationRace.releaseOld?.())
      await expect.poll(() => page.evaluate(() => window.postNavigationRace.oldCancelled)).toBe(1)
      await page.evaluate(() => window.postNavigationRace.queuedSentinel?.())
      expect(await page.evaluate(() => window.postNavigationRace.queueFlushed)).toBe(true)
      unblock()
      await expect(page.getByRole('heading', { name: title, exact: true }).first()).toBeVisible()
      await expect(page.getByRole('button', { name: '返回上一页', exact: true })).toBeVisible()
      await expect(page).toHaveURL(new RegExp(`${href}$`))
      expect(await page.evaluate(() => window.postNavigationRace.pageAttempts)).toBe(1)
      await testInfo.attach('cancelled-sentinel-race', {
        body: JSON.stringify({
          layout,
          href,
          detailBlocked,
          ...(await page.evaluate(() => ({
            oldCancelled: window.postNavigationRace.oldCancelled,
            pageAttempts: window.postNavigationRace.pageAttempts,
            queueFlushed: window.postNavigationRace.queueFlushed,
          }))),
        }),
        contentType: 'application/json',
      })
    } finally {
      unblock()
      await page.evaluate(() => window.postNavigationRace.releaseOld?.()).catch(() => {})
    }
  })

  test(`${layout}鼠标重复打开已聚焦的设置入口，Esc始终归还原按钮`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: layout, url: baseURL! }])
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/app-client-ready/)
    const entry = page.getByRole('button', { name: '界面设置', exact: true })
    if (!(await entry.isVisible())) await page.getByRole('button', { name: '更多导航', exact: true }).click()
    for (let cycle = 0; cycle < 2; cycle++) {
      if (cycle) await expect(entry).toBeFocused()
      await entry.click()
      await expect(page.getByRole('dialog', { name: '界面设置', exact: true })).toBeVisible()
      await page.getByRole('button', { name: '关闭界面设置', exact: true }).press('Escape')
      await expect(page.getByRole('dialog', { name: '界面设置', exact: true })).toHaveCount(0)
      await expect(entry).toBeFocused()
    }
  })
}
