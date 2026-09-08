/**
 * @file motion-remediation.spec.ts
 * @description 动效整改隔离回归：导航竞态、焦点、订阅、减少模式及图片恢复
 * @author TixXin
 * @since 2026-09-08
 */
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { captureMotion, prepareMotionCapture } from './motionScreenshot'

const browserErrors = new WeakMap<Page, string[]>()
test.beforeEach(({ page, browserName }) => {
  prepareMotionCapture(page, browserName)
  const errors: string[] = []
  browserErrors.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type()) && /Hydration|\[Vue warn\]/.test(message.text()))
      errors.push(message.text())
  })
})
test.afterEach(({ page }) => {
  expect(browserErrors.get(page) ?? []).toEqual([])
})

async function ready(page: Page) {
  await expect(page.locator('html')).toHaveClass(/app-client-ready/)
  await expect(page.locator('.loading-screen:visible')).toHaveCount(0)
  await expect.poll(() => page.locator('html').evaluate((node) => getComputedStyle(node).opacity)).toBe('1')
}
async function settings(page: Page) {
  const entry = page.getByRole('button', { name: '界面设置', exact: true })
  if (!(await entry.isVisible())) await page.getByRole('button', { name: '更多导航', exact: true }).click()
  await entry.click()
  await expect(page.getByRole('dialog', { name: '界面设置', exact: true })).toBeVisible()
}
async function closeSettings(page: Page) {
  await page.getByRole('button', { name: '关闭界面设置', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '界面设置', exact: true })).toHaveCount(0)
  if (await page.getByRole('dialog', { name: '更多导航', exact: true }).isVisible()) await page.keyboard.press('Escape')
}

test('首屏内容就绪后，加载层淡出不再拦截操作', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const samples: { at: number; pointer: string }[] = []
    ;(window as unknown as { readyExitSamples: typeof samples }).readyExitSamples = samples
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.target instanceof HTMLElement && record.target.matches('.loading-screen-leave-active')) {
          samples.push({ at: performance.now(), pointer: getComputedStyle(record.target).pointerEvents })
        }
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] })
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('html')).toHaveClass(/app-client-ready/)
  await page.getByRole('button', { name: '界面设置', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '界面设置', exact: true })).toBeVisible()
  const samples = await page.evaluate(
    () => (window as unknown as { readyExitSamples: { at: number; pointer: string }[] }).readyExitSamples,
  )
  expect(samples.length).toBeGreaterThan(0)
  expect(samples.every((sample) => sample.pointer === 'none')).toBe(true)
  await testInfo.attach('ready-exit', { body: JSON.stringify(samples), contentType: 'application/json' })
})

for (const layout of ['nexus', 'aurora', 'dock']) {
  for (const mode of ['normal', 'off', 'reduce']) {
    test(`慢请求 ${layout}/${mode} 被导航取消后不会覆盖全宽页面`, async ({ page, context, baseURL }, testInfo) => {
      await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: layout, url: baseURL! }])
      await page.emulateMedia({ reducedMotion: mode === 'reduce' ? 'reduce' : 'no-preference' })
      await page.goto('/')
      await ready(page)
      if (mode === 'off') {
        await settings(page)
        await page
          .getByRole('heading', { name: '主内容切换', exact: true })
          .locator('..')
          .locator('..')
          .getByRole('button', { name: '关闭动画', exact: true })
          .click()
        await closeSettings(page)
      }
      let release!: () => void
      let blocked = 0
      const cancelled: string[] = []
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      page.on('requestfailed', (request) => {
        if (request.url().endsWith('/api/v1/posts/105')) cancelled.push(request.failure()?.errorText ?? 'cancelled')
      })
      await page.route('**/api/v1/posts/105', async (route) => {
        blocked++
        await gate
        await route.continue().catch(() => {})
      })
      try {
        await page.locator('a.post-item[href="/articles/105"]').click()
        await expect.poll(() => blocked).toBeGreaterThan(0)
        expect((await page.locator('main').innerText()).length).toBeGreaterThan(100)
        await page.getByRole('link', { name: '标签页', exact: true }).click()
        await expect(page).toHaveURL(/\/tabs$/)
        await expect(page.locator('.tabs-page')).toBeVisible()
        await expect.poll(() => cancelled.length, { timeout: 1500, intervals: [50, 100] }).toBeGreaterThan(0)
        release()
        await page.waitForTimeout(500)
        await expect(page.locator('.tabs-page')).toBeVisible()
        await expect(page).toHaveTitle(/标签页/)
        await expect(page.locator('[data-page-motion-clone],.sidebar-leaving-clone')).toHaveCount(0)
        await page.goBack()
        await expect(page).toHaveURL(/\/articles\/105$/)
        await expect(page.getByRole('heading', { name: '分页样本 104', exact: true })).toBeVisible()
        await page.goForward()
        await expect(page.locator('.tabs-page')).toBeVisible()
        await expect(page.locator('#__nuxt[inert]')).toHaveCount(0)
        await testInfo.attach('cancelled-article-request', {
          body: JSON.stringify({ blocked, cancelled }),
          contentType: 'application/json',
        })
      } finally {
        release()
      }
    })
  }
}

for (const part of ['related', 'navigation', 'comments']) {
  test(`离开文章时取消${part}初始化读取并保持目标页面`, async ({ page }, testInfo) => {
    await page.goto('/')
    await ready(page)
    let release!: () => void
    let blocked = 0
    const cancelled: string[] = []
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    page.on('requestfailed', (request) => {
      if (request.url().endsWith(`/api/v1/posts/105/${part}`))
        cancelled.push(request.failure()?.errorText ?? 'cancelled')
    })
    await page.route(`**/api/v1/posts/105/${part}`, async (route) => {
      blocked++
      await gate
      await route.continue().catch(() => {})
    })
    try {
      await page.locator('a.post-item[href="/articles/105"]').click()
      await expect.poll(() => blocked).toBeGreaterThan(0)
      await page.getByRole('link', { name: '标签页', exact: true }).click()
      await expect(page.locator('.tabs-page')).toBeVisible()
      await expect.poll(() => cancelled.length, { timeout: 1500, intervals: [50, 100] }).toBeGreaterThan(0)
      release()
      await page.waitForTimeout(250)
      await expect(page).toHaveURL(/\/tabs$/)
      await expect(page.locator('.tabs-page')).toBeVisible()
      await testInfo.attach('cancelled-initial-read', {
        body: JSON.stringify({ part, blocked, cancelled }),
        contentType: 'application/json',
      })
    } finally {
      release()
    }
  })
}

test('仍在当前文章的真实请求失败继续显示503错误反馈', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  await page.route('**/api/v1/posts/105', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: 503, message: '隔离网络错误验收' }),
    }),
  )
  await page.locator('a.post-item[href="/articles/105"]').click()
  await expect(page.getByRole('heading', { name: '服务器错误', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '重试当前页面', exact: true })).toBeVisible()
})

for (const layout of ['nexus', 'aurora', 'dock']) {
  for (const mode of ['normal', 'off', 'reduce']) {
    for (const gap of [30, 120, 300]) {
      test(`导航 ${layout}/${mode}/${gap}ms 最终页面完整`, async ({ page, context, baseURL }, testInfo) => {
        await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: layout, url: baseURL! }])
        await page.emulateMedia({ reducedMotion: mode === 'reduce' ? 'reduce' : 'no-preference' })
        await page.goto('/')
        await ready(page)
        if (mode === 'off') {
          await settings(page)
          await page
            .getByRole('heading', { name: '主内容切换', exact: true })
            .locator('..')
            .locator('..')
            .getByRole('button', { name: '关闭动画', exact: true })
            .click()
          await closeSettings(page)
        }
        const points: Record<string, { x: number; y: number }> = {}
        for (const name of ['归档', '项目', '主页']) {
          const box = await page.getByRole('link', { name, exact: true }).boundingBox()
          expect(box).not.toBeNull()
          points[name] = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }
        }
        for (let round = 0; round < 5; round++) {
          for (const name of ['归档', '项目', '主页']) {
            const point = points[name]!
            await page.mouse.click(point.x, point.y)
            await page.waitForTimeout(gap)
          }
        }
        await expect(page).toHaveURL(/\/$/)
        await expect(page.locator('.articles-page .post-item')).toHaveCount(15)
        await expect(page).not.toHaveTitle(/项目展示|文章归档/)
        await expect(page.locator('.sidebar-leaving-clone')).toHaveCount(0)
        await expect(page.locator('#__nuxt[inert]')).toHaveCount(0)
        await page.getByRole('link', { name: '关于', exact: true }).click()
        await expect(page.locator('main')).toContainText('技能示例')
        if (gap === 30) await captureMotion(page, testInfo, `${layout}-${mode}.png`)
      })
    }
  }
}

for (const layout of ['nexus', 'aurora']) {
  test(`取消导航恢复 ${layout} 侧栏`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: layout, url: baseURL! }])
    await page.goto('/')
    await ready(page)
    await page.evaluate(() => {
      const app = (
        document.querySelector('#__nuxt') as HTMLElement & {
          __vue_app__: {
            config: {
              globalProperties: {
                $router: { beforeEach: (guard: (to: { path: string }) => boolean | undefined) => () => void }
              }
            }
          }
        }
      ).__vue_app__
      app.config.globalProperties.$router.beforeEach((to) => (to.path === '/archive' ? false : undefined))
    })
    await page.getByRole('link', { name: '归档', exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator('#right-sidebar-target > .right-sidebar-wrapper')).toBeVisible()
    await expect(page.locator('.sidebar-leaving-clone')).toHaveCount(0)
  })
}

for (const method of ['keyboard', 'mouse']) {
  test(`搜索 ${method} 导航不重开并聚焦正文`, async ({ page }, testInfo) => {
    await page.goto('/')
    await ready(page)
    const entry = page.getByRole('button', { name: '搜索站内文章、标签...', exact: true })
    await entry.click()
    const input = page.getByRole('textbox', { name: '搜索文章、项目和友链', exact: true })
    await input.fill('分页样本 104')
    await expect(page.locator('.search-modal__item')).toHaveCount(1)
    await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true })
    await expect(page).toHaveURL(/\/$/)
    if (method === 'keyboard') await input.press('Enter')
    else await page.locator('.search-modal__item').click()
    await expect(page).toHaveURL(/\/articles\/\d+/)
    await expect(page.getByRole('dialog', { name: '站内搜索', exact: true })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: '分页样本 104', exact: true })).toBeFocused()
    await captureMotion(page, testInfo, `search-${method}.png`)
    await page.goto('/')
    await ready(page)
    await entry.click()
    await page.keyboard.press('Escape')
    await expect(entry).toBeFocused()
  })
}

test('颜色切换100次不增加媒体查询订阅，模态30次无残留锁', async ({ page }, testInfo) => {
  test.setTimeout(120000)
  await page.goto('/')
  await ready(page)
  await settings(page)
  await page.getByRole('button', { name: '无动画', exact: true }).click()
  await page.evaluate(() => {
    const original = MediaQueryList.prototype.addEventListener
    const originalRemove = MediaQueryList.prototype.removeEventListener
    ;(window as unknown as { motionQueryAdds: number }).motionQueryAdds = 0
    ;(window as unknown as { motionQueryRemoves: number }).motionQueryRemoves = 0
    MediaQueryList.prototype.addEventListener = function (...args: Parameters<typeof original>) {
      ;(window as unknown as { motionQueryAdds: number }).motionQueryAdds++
      return original.apply(this, args)
    }
    MediaQueryList.prototype.removeEventListener = function (...args: Parameters<typeof originalRemove>) {
      ;(window as unknown as { motionQueryRemoves: number }).motionQueryRemoves++
      return originalRemove.apply(this, args)
    }
  })
  for (let i = 0; i < 100; i++) await page.getByRole('button', { name: i % 2 ? '深色' : '浅色', exact: true }).click()
  expect(await page.evaluate(() => (window as unknown as { motionQueryAdds: number }).motionQueryAdds)).toBe(0)
  await closeSettings(page)
  for (let i = 0; i < 30; i++) {
    await settings(page)
    await closeSettings(page)
    await expect(page.locator('#__nuxt[inert]')).toHaveCount(0)
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
  }
  const subscriptions = await page.evaluate(() => {
    const ledger = window as unknown as { motionQueryAdds: number; motionQueryRemoves: number }
    return { added: ledger.motionQueryAdds, removed: ledger.motionQueryRemoves }
  })
  expect(subscriptions.added - subscriptions.removed).toBeLessThanOrEqual(0)
  await testInfo.attach('media-subscriptions-after-warmup', {
    body: JSON.stringify({ colorSwitches: 100, modalCycles: 30, ...subscriptions }),
    contentType: 'application/json',
  })
})

test('运行中减少动态效果停止运动，关闭后不依赖结束事件', async ({ page }, testInfo) => {
  await page.goto('/')
  await ready(page)
  await page.evaluate(() => {
    ;(window as unknown as { originalPage: Element | null }).originalPage = document.querySelector('.articles-page')
  })
  await page.getByRole('button', { name: '搜索站内文章、标签...', exact: true }).click()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { originalPage: Element | null }).originalPage ===
        document.querySelector('.articles-page'),
    ),
  ).toBe(true)
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document
            .getAnimations()
            .filter(
              (animation) =>
                animation.playState === 'running' &&
                animation.effect?.getKeyframes().some((frame) => 'transform' in frame),
            ).length,
      ),
    )
    .toBe(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: '下一页', exact: true }).click()
  await expect(page.locator('.post-item')).toHaveCount(15)
  await expect(page.locator('#__nuxt[inert]')).toHaveCount(0)
  await captureMotion(page, testInfo, 'reduce-live.png')
})

test('照片失败保持占位，恢复后可重试且不跳动', async ({ page }, testInfo) => {
  await page.route('**/images.unsplash.com/**', (route) => route.abort())
  await page.goto('/gallery')
  await ready(page)
  const first = page.locator('.gallery-item').first()
  await expect(first.getByRole('button', { name: /重新加载图片/ })).toBeVisible()
  const failed = await first.boundingBox()
  await captureMotion(page, testInfo, 'image-failed.png')
  await page.unroute('**/images.unsplash.com/**')
  await first.getByRole('button', { name: /重新加载图片/ }).click()
  await expect(first.locator('.image-frame')).toHaveClass(/image-frame--ready/)
  const loaded = await first.boundingBox()
  expect(Math.abs(loaded!.height - failed!.height)).toBeLessThan(1)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('Tooltip支持Esc并保留焦点', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  const trigger = page.getByRole('button', { name: '连续加载', exact: true })
  await trigger.focus()
  await expect(page.getByRole('tooltip', { name: '连续加载', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tooltip', { name: '连续加载', exact: true })).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await page.waitForTimeout(400)
  await expect(page.getByRole('tooltip', { name: '连续加载', exact: true })).toHaveCount(0)
})

for (const width of [320, 1440]) {
  test(`长提示 ${width}px 可键盘阅读、悬停保持且不越界`, async ({ page, context, baseURL }, testInfo) => {
    await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: 'dock', url: baseURL! }])
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/about')
    await ready(page)
    const trigger = page.locator('.footer__status')
    await trigger.scrollIntoViewIfNeeded()
    await trigger.focus()
    const tooltip = page.getByRole('tooltip', { name: '仅表示本次资料读取结果，不代表全站运行监控', exact: true })
    await expect(tooltip).toBeVisible()
    const metrics = await tooltip.evaluate((element) => ({ width: element.clientWidth, scroll: element.scrollWidth }))
    expect(metrics.scroll).toBeLessThanOrEqual(metrics.width + 1)
    const box = await tooltip.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(width)
    await page.keyboard.press('Escape')
    await expect(tooltip).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await page.getByRole('link', { name: '主页', exact: true }).focus()
    await trigger.hover()
    await expect(tooltip).toBeVisible()
    const hoverBox = await tooltip.boundingBox()
    await page.mouse.move(hoverBox!.x + hoverBox!.width / 2, hoverBox!.y + hoverBox!.height / 2)
    await page.waitForTimeout(350)
    await expect(tooltip).toBeVisible()
    await captureMotion(page, testInfo, `long-tooltip-${width}.png`)
    await page.keyboard.press('Escape')
    await expect(tooltip).toHaveCount(0)
  })
}

test('正常页面的标题与正文独立过渡，离场快照不包含标题', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  await page.evaluate(() => {
    const native = Element.prototype.animate
    const regions = { root: false, header: false, body: false, cloneHeader: false }
    Object.assign(window, { checkedPageRegions: regions })
    Element.prototype.animate = function (...args) {
      if (this.hasAttribute('data-page-frame')) regions.root = true
      if (this.hasAttribute('data-page-header')) regions.header = true
      if (this.hasAttribute('data-page-body') && !this.hasAttribute('data-page-motion-clone')) regions.body = true
      if (this.hasAttribute('data-page-motion-clone') && this.querySelector('[data-page-header]'))
        regions.cloneHeader = true
      return native.apply(this, args)
    }
  })
  await page.getByRole('link', { name: '归档', exact: true }).click()
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document
              .getAnimations()
              .filter(
                (animation) =>
                  animation.playState === 'running' &&
                  animation.effect?.target instanceof HTMLElement &&
                  animation.effect.target.matches('[data-page-header],[data-page-body],[data-page-motion-clone]'),
              ).length,
        ),
      { intervals: [10, 20, 20] },
    )
    .toBeGreaterThan(0)
  await expect(page.locator('[data-page-motion-clone]')).toHaveCount(0)
  await expect(page.locator('main')).toContainText('文章归档')
  await expect(page.locator('[data-page-motion-clone] [id]')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { checkedPageRegions: object }).checkedPageRegions)).toEqual({
    root: false,
    header: true,
    body: true,
    cloneHeader: false,
  })
})
