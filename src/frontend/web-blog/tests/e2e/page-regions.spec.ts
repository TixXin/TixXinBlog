/** @file page-regions.spec.ts @description 验证标题和正文真实动画边界、共享标签焦点与导航收尾 */
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { prepareMotionCapture, captureMotion } from './motionScreenshot'

const pageErrors = new WeakMap<Page, string[]>()
test.beforeEach(async ({ page, browserName }) => {
  prepareMotionCapture(page, browserName)
  const errors: string[] = []
  pageErrors.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (/Hydration|\[Vue warn\]/.test(message.text())) errors.push(message.text())
  })
  await page.addInitScript(() => {
    const native = Element.prototype.animate
    const records: unknown[] = []
    Object.assign(window, { regionMotions: records })
    Element.prototype.animate = function (...args) {
      const animation = native.apply(this, args)
      if (this.matches('[data-page-header],[data-page-body],[data-page-motion-clone],[data-page-frame]')) {
        records.push({
          header: this.hasAttribute('data-page-header'),
          body: this.hasAttribute('data-page-body'),
          root: this.hasAttribute('data-page-frame'),
          clone: this.hasAttribute('data-page-motion-clone'),
          frames: (animation.effect as KeyframeEffect).getKeyframes(),
          duration: animation.effect?.getTiming().duration,
        })
      }
      return animation
    }
  })
})
test.afterEach(({ page }) => expect(pageErrors.get(page) ?? []).toEqual([]))
async function ready(page: Page, selector: string) {
  await expect(page.locator('html')).toHaveClass(/app-client-ready/)
  await expect(page.locator('.loading-screen:visible')).toHaveCount(0)
  await expect(page.locator(selector)).toBeVisible()
  await expect(page.locator('[data-page-motion-overlay]')).toHaveCount(0)
}
async function clear(page: Page) {
  await page.evaluate(() => {
    ;(window as unknown as { regionMotions: unknown[] }).regionMotions.length = 0
  })
}
async function records(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          regionMotions: {
            header: boolean
            body: boolean
            root: boolean
            clone: boolean
            frames: { transform?: string }[]
            duration: number
          }[]
        }
      ).regionMotions,
  )
}
for (const layout of ['nexus', 'aurora', 'dock']) {
  test(`共享标题 ${layout} 标签不移动，正文独立进入和退出`, async ({ page, context, baseURL }, testInfo) => {
    await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: layout, url: baseURL! }])
    await page.goto('/')
    await ready(page, '.articles-page')
    const nav = page.getByRole('navigation', { name: '内容类型' })
    const geometry = () =>
      page.locator('[data-page-header]').evaluate((el) => {
        const r = el.getBoundingClientRect(),
          card = el.closest('.main-content')!.getBoundingClientRect()
        return {
          x: r.x - card.x,
          y: r.y - card.y,
          opacity: getComputedStyle(el).opacity,
          transform: getComputedStyle(el).transform,
        }
      })
    const before = await geometry()
    await clear(page)
    const link = nav.getByRole('link', { name: '朋友圈', exact: true })
    await link.focus()
    await page.keyboard.press('Enter')
    await ready(page, '.moments-page')
    expect(await geometry()).toEqual(before)
    await expect(nav.getByRole('link', { name: '朋友圈', exact: true })).toBeFocused()
    const motion = await records(page)
    expect(motion.some((m) => m.root || m.header)).toBe(false)
    expect(motion.some((m) => m.body && !m.clone && m.duration === 150)).toBe(true)
    expect(motion.some((m) => m.clone)).toBe(true)
    await captureMotion(page, testInfo, `${layout}-feed-regions.png`)
    await clear(page)
    await nav.getByRole('link', { name: '全部文章', exact: true }).click()
    await ready(page, '.articles-page')
    expect((await records(page)).some((m) => m.header || m.root)).toBe(false)
  })

  test(`栏目分区 ${layout} 标题120ms淡入，正文快照不覆盖标题`, async ({ page, context, baseURL }, testInfo) => {
    await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: layout, url: baseURL! }])
    await page.goto('/')
    await ready(page, '.articles-page')
    for (const [name, path] of [
      ['归档', '/archive'],
      ['项目', '/projects'],
      ['画廊', '/gallery'],
      ['闪念', '/flash'],
      ['友链', '/links'],
      ['留言', '/guestbook'],
    ]) {
      await clear(page)
      // 记录真实帧，避免只靠最终截图判断分区是否独立。
      const samples = page.evaluate(
        () =>
          new Promise<{ overlap: boolean; headerMoved: boolean; cloneHeader: boolean }[]>((resolve) => {
            const start = performance.now(),
              values: { overlap: boolean; headerMoved: boolean; cloneHeader: boolean }[] = []
            const tick = () => {
              const header = document.querySelector('[data-page-frame] > [data-page-header]')
              const overlay = document.querySelector('[data-page-motion-overlay]')
              values.push({
                overlap:
                  !!header &&
                  !!overlay &&
                  overlay.getBoundingClientRect().top < header.getBoundingClientRect().bottom - 1,
                headerMoved: !!header && getComputedStyle(header).transform !== 'none',
                cloneHeader: !!overlay?.querySelector('[data-page-header],.main-content__header'),
              })
              if (performance.now() - start < 700) requestAnimationFrame(tick)
              else resolve(values)
            }
            requestAnimationFrame(tick)
          }),
      )
      await page.getByRole('link', { name, exact: true }).filter({ visible: true }).first().click()
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await ready(page, '[data-page-frame]')
      expect(
        await page.locator('[data-page-body]').evaluate((el) => el.getBoundingClientRect().height),
      ).toBeGreaterThan(150)
      const frames = await samples
      expect(frames.some((frame) => frame.overlap || frame.headerMoved || frame.cloneHeader)).toBe(false)
      const motion = await records(page)
      expect(motion.some((m) => m.root)).toBe(false)
      expect(motion.find((m) => m.header)?.duration).toBe(120)
      expect(motion.filter((m) => m.header).every((m) => m.frames.every((frame) => !('transform' in frame)))).toBe(true)
      expect(motion.some((m) => m.body && !m.clone)).toBe(true)
      await testInfo.attach(`regions-${path.slice(1)}`, {
        body: JSON.stringify({ frames, motion }),
        contentType: 'application/json',
      })
    }
  })

  test(`慢导航 ${layout} 保留标题正文，加载提示仅在正文区`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: layout, url: baseURL! }])
    await page.goto('/moments')
    await ready(page, '.moments-page')
    await clear(page)
    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    let intercepted = false
    await page.route(
      (url) => url.pathname === '/api/v1/posts',
      async (route) => {
        intercepted = true
        await held
        await route.continue()
      },
    )
    await page
      .getByRole('navigation', { name: '内容类型' })
      .getByRole('link', { name: '全部文章', exact: true })
      .click()
    await expect.poll(() => intercepted).toBe(true)
    try {
      await expect(page.locator('.moments-page')).toBeVisible()
      await expect(page.locator('[data-page-header] [aria-current="page"]')).toHaveText('朋友圈')
      await expect(page.locator('[data-page-body-frame] [data-page-motion-status]')).toBeVisible()
      expect(await page.locator('[data-page-header]').evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
      expect(await records(page)).toHaveLength(0)
      await page.emulateMedia({ reducedMotion: 'reduce' })
    } finally {
      release()
    }
    await ready(page, '.articles-page')
    await expect(page.locator('[data-page-body] .post-item')).toHaveCount(15)
    expect(await records(page)).toHaveLength(0)
    await expect(page.locator('[data-page-motion-status]:visible')).toHaveCount(0)
  })

  for (const mode of ['off', 'reduce']) {
    test(`关闭分区动效 ${layout}/${mode} 仍可切换页面`, async ({ page, context, baseURL }) => {
      await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: layout, url: baseURL! }])
      if (mode === 'reduce') await page.emulateMedia({ reducedMotion: 'reduce' })
      else
        await page.addInitScript(() =>
          localStorage.setItem('tixxin-blog-appearance', JSON.stringify({ contentTransitionPreset: 'none' })),
        )
      await page.goto('/')
      await ready(page, '.articles-page')
      await clear(page)
      await page.getByRole('link', { name: '归档', exact: true }).filter({ visible: true }).first().click()
      await ready(page, '.archive-page')
      expect(await records(page)).toHaveLength(0)
    })
  }
}

test('取消导航保留现有标题和正文，查询更新不触发标题过渡', async ({ page }) => {
  await page.goto('/')
  await ready(page, '.articles-page')
  await clear(page)
  await page.evaluate(() => {
    const app = (
      document.querySelector('#__nuxt') as HTMLElement & {
        __vue_app__: {
          config: {
            globalProperties: {
              $router: { beforeEach: (guard: (to: { path: string }) => boolean | undefined) => void }
            }
          }
        }
      }
    ).__vue_app__
    app.config.globalProperties.$router.beforeEach((to) => (to.path === '/archive' ? false : undefined))
  })
  await page.getByRole('link', { name: '归档', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator('[data-page-header] [aria-current="page"]')).toHaveText('全部文章')
  await expect(page.locator('[data-page-body] .post-item')).toHaveCount(15)
  await expect(page.locator('[data-page-motion-status]:visible')).toHaveCount(0)
  expect(await records(page)).toHaveLength(0)
  await page.getByRole('button', { name: '下一页', exact: true }).click()
  await expect(page.locator('.post-item').first()).toHaveAttribute('href', '/articles/91')
  expect((await records(page)).some((m) => m.header || m.root)).toBe(false)
})

test('分区页面SSR直接包含标题与正文，特殊页面保留原结构', async ({ page, context, baseURL }) => {
  const staticContext = await context.browser()!.newContext({ javaScriptEnabled: false, baseURL })
  const staticPage = await staticContext.newPage()
  await staticPage.goto('/')
  await expect(staticPage.locator('[data-page-header]')).toContainText('全部文章')
  await expect(staticPage.locator('[data-page-body] .post-item')).toHaveCount(15)
  await staticContext.close()
  for (const path of ['/about', '/tabs', '/articles/106']) {
    await page.goto(path)
    await expect(page.locator('html')).toHaveClass(/app-client-ready/)
    await expect(page.locator('[data-page-frame]')).toHaveCount(0)
  }
})
