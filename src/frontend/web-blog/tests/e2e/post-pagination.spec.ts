/**
 * @file post-pagination.spec.ts
 * @description 真实分页传输与动画时序：慢请求、连续操作、失败恢复、历史和动效偏好
 */
import { test, expect } from '@playwright/test'
import type { Page, BrowserContext } from '@playwright/test'
import { captureMotion, prepareMotionCapture } from './motionScreenshot'

type Mode = 'normal' | 'off' | 'reduce' | 'fade' | 'soft-slide'
test.beforeEach(({ page, browserName }) => prepareMotionCapture(page, browserName))
async function setup(page: Page, context: BrowserContext, baseURL: string, layout: string, mode: Mode, width = 1440) {
  await page.setViewportSize({ width, height: 1000 })
  await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: layout, url: baseURL }])
  await context.addInitScript(
    (preset) => {
      localStorage.setItem(
        'tixxin-blog-appearance',
        JSON.stringify({
          contentTransitionPreset: preset,
          sidebarAnimationPreset: 'none',
          colorModeTransitionPreset: 'none',
          paginationAutoHide: false,
        }),
      )
      const native = Element.prototype.animate
      const records: unknown[] = []
      Object.assign(window, { postPageAnimations: records })
      Element.prototype.animate = function (...args) {
        const animation = native.apply(this, args)
        if (this.classList.contains('post-list'))
          records.push({
            href: this.querySelector('a')?.getAttribute('href'),
            frames: animation.effect?.getKeyframes(),
            duration: animation.effect?.getTiming().duration,
          })
        return animation
      }
    },
    mode === 'off' ? 'none' : mode === 'fade' || mode === 'soft-slide' ? mode : 'vertical-slide',
  )
  await page.emulateMedia({ reducedMotion: mode === 'reduce' ? 'reduce' : 'no-preference' })
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/app-client-ready/)
  await expect(page.locator('.loading-screen:visible')).toHaveCount(0)
  await expect(page.locator('.post-list .post-item')).toHaveCount(15)
  await page.evaluate(() => Object.assign(window, { originalPostList: document.querySelector('.post-list') }))
}

async function assertSettled(page: Page, expectedPage: number) {
  await expect(page).toHaveURL(new RegExp(`page=${expectedPage}(?:&|$)`))
  const response = await page.request.get(`/api/v1/posts?page=${expectedPage}&pageSize=15`)
  expect(response.ok()).toBe(true)
  const { data } = await response.json()
  const cards = page.locator('.post-list .post-item')
  await expect(cards).toHaveCount(data.items.length)
  await expect(cards.first()).toHaveAttribute('href', `/articles/${data.items[0].id}`)
  await expect(page.getByRole('navigation', { name: '文章分页' }).locator('[aria-current="page"]')).toHaveText(
    String(expectedPage),
  )
  await expect
    .poll(() => page.locator('.post-list').evaluate((el) => el.getAnimations().length), { timeout: 1000 })
    .toBe(0)
  expect(
    await page.locator('.post-list').evaluate((el) => ({
      same: el === (window as unknown as { originalPostList: Element }).originalPostList,
      opacity: getComputedStyle(el).opacity,
      transform: getComputedStyle(el).transform,
    })),
  ).toEqual({ same: true, opacity: '1', transform: 'none' })
  return data
}

for (const layout of ['nexus', 'aurora', 'dock']) {
  test(`分页与标签联动 ${layout} 等待中离开后旧响应不会覆盖朋友圈`, async ({ page, context, baseURL }) => {
    await setup(page, context, baseURL!, layout, 'normal')
    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    let intercepted = false
    await page.route(
      (url) => url.pathname === '/api/v1/posts' && url.searchParams.get('page') === '2',
      async (route) => {
        intercepted = true
        await held
        await route.continue().catch(() => {})
      },
    )
    await page.getByRole('button', { name: '2', exact: true }).click()
    await expect.poll(() => intercepted).toBe(true)
    try {
      await page
        .getByRole('navigation', { name: '内容类型' })
        .getByRole('link', { name: '朋友圈', exact: true })
        .click()
      await expect(page.locator('.moments-page')).toBeVisible()
    } finally {
      release()
    }
    await page.waitForTimeout(300)
    await expect(page).toHaveURL(/\/moments$/)
    await expect(page.locator('.articles-page')).toHaveCount(0)
    await expect(
      page.getByRole('navigation', { name: '内容类型' }).getByRole('link', { name: '朋友圈', exact: true }),
    ).toHaveAttribute('aria-current', 'page')
    await page.goBack()
    await expect(page).toHaveURL(/page=2$/)
    await expect(page.locator('.post-list .post-item').first()).toHaveAttribute('href', '/articles/91')
    await expect(page.getByRole('navigation', { name: '文章分页' }).locator('[aria-current="page"]')).toHaveText('2')
  })

  for (const mode of ['normal', 'off', 'reduce'] as const) {
    test(`慢分页 ${layout}/${mode} 只对已到齐的新内容过渡`, async ({ page, context, baseURL }, testInfo) => {
      await setup(page, context, baseURL!, layout, mode, mode === 'reduce' ? 390 : 1440)
      let release!: () => void
      const held = new Promise<void>((resolve) => {
        release = resolve
      })
      let intercepted = false
      await page.route(
        (url) => url.pathname === '/api/v1/posts' && url.searchParams.get('page') === '2',
        async (route) => {
          intercepted = true
          await held
          await route.continue()
        },
      )
      const original = await page.locator('.post-list .post-item').first().getAttribute('href')
      await page.getByRole('button', { name: '下一页', exact: true }).click()
      await expect.poll(() => intercepted).toBe(true)
      const waiting = await page.evaluate(
        () =>
          new Promise<Record<string, unknown>[]>((resolve) => {
            const start = performance.now(),
              samples: Record<string, unknown>[] = []
            const tick = () => {
              const el = document.querySelector('.post-list')
              samples.push({
                at: performance.now() - start,
                href: el?.querySelector('a')?.getAttribute('href'),
                opacity: el && getComputedStyle(el).opacity,
                animations: el?.getAnimations().filter((a) => a.playState === 'running').length,
                same: el === (window as unknown as { originalPostList: Element }).originalPostList,
              })
              if (performance.now() - start < 650) requestAnimationFrame(tick)
              else resolve(samples)
            }
            requestAnimationFrame(tick)
          }),
      )
      try {
        expect(
          waiting.every(
            (sample) => sample.href === original && sample.opacity === '1' && sample.animations === 0 && sample.same,
          ),
        ).toBe(true)
      } finally {
        release()
      }
      const data = await assertSettled(page, 2)
      const animations = await page.evaluate(
        () => (window as unknown as { postPageAnimations: { href: string }[] }).postPageAnimations,
      )
      expect(animations).toHaveLength(mode === 'normal' ? 1 : 0)
      if (mode === 'normal') expect(animations[0]!.href).toBe(`/articles/${data.items[0].id}`)
      await testInfo.attach('pending-frames-and-accepted-motion', {
        body: JSON.stringify({ waiting, animations }),
        contentType: 'application/json',
      })
      if (mode === 'normal') await captureMotion(page, testInfo, `${layout}-pagination-ready.png`)
    })

    test(`快速分页 ${layout}/${mode} 可替换慢请求并显示最后一页`, async ({ page, context, baseURL }) => {
      await setup(page, context, baseURL!, layout, mode)
      let release!: () => void
      const held = new Promise<void>((resolve) => {
        release = resolve
      })
      let intercepted = false
      await page.route(
        (url) => url.pathname === '/api/v1/posts' && url.searchParams.get('page') === '2',
        async (route) => {
          intercepted = true
          await held
          await route.continue().catch(() => {})
        },
      )
      await page.getByRole('button', { name: '2', exact: true }).click()
      await expect.poll(() => intercepted).toBe(true)
      try {
        await expect(page.getByRole('button', { name: '3', exact: true })).toBeEnabled()
        await page.getByRole('button', { name: '3', exact: true }).click()
        await expect(page.locator('.post-list .post-item').first()).toHaveAttribute('href', '/articles/76')
        await page.getByRole('button', { name: '4', exact: true }).click()
        await assertSettled(page, 4)
      } finally {
        release()
      }
      await page.waitForTimeout(300)
      await assertSettled(page, 4)
      await page.goBack()
      await assertSettled(page, 3)
      await page.goForward()
      await assertSettled(page, 4)
    })
  }

  test(`分页恢复 ${layout} 失败保留原内容，重试和末页切模式可用`, async ({ page, context, baseURL }, testInfo) => {
    await setup(page, context, baseURL!, layout, 'normal', 390)
    let fail = true
    await page.route(
      (url) => url.pathname === '/api/v1/posts' && url.searchParams.get('page') === '2',
      (route) =>
        fail ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }) : route.continue(),
    )
    const original = await page.locator('.post-list .post-item').first().getAttribute('href')
    await page.getByRole('button', { name: '2', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('已保留原列表')
    await expect(page.locator('.post-list .post-item').first()).toHaveAttribute('href', original!)
    expect(
      await page.evaluate(() => (window as unknown as { postPageAnimations: unknown[] }).postPageAnimations.length),
    ).toBe(0)
    fail = false
    await page.getByRole('button', { name: '重试', exact: true }).click()
    const data = await assertSettled(page, 2)
    const last = Math.ceil(data.total / 15)
    await page.getByRole('button', { name: String(last), exact: true }).click()
    await assertSettled(page, last)
    await expect(page.getByRole('button', { name: '下一页', exact: true })).toBeDisabled()
    await captureMotion(page, testInfo, `${layout}-last-page.png`)
    await page.getByRole('button', { name: '连续加载', exact: true }).click()
    await expect(page.locator('.post-list .post-item')).toHaveCount(15)
    await expect(page.locator('.post-list .post-item').first()).toHaveAttribute('href', '/articles/106')
    await page.getByRole('button', { name: '分页显示', exact: true }).click()
    await expect(page.locator('.post-list .post-item')).toHaveCount(15)
    await expect(page.getByRole('navigation', { name: '文章分页' }).locator('[aria-current="page"]')).toHaveText('1')
  })
}

for (const mode of ['fade', 'soft-slide'] as const) {
  test(`分页遵守${mode}预设`, async ({ page, context, baseURL }) => {
    await setup(page, context, baseURL!, 'nexus', mode)
    await page.getByRole('button', { name: '2', exact: true }).click()
    await assertSettled(page, 2)
    const animations = await page.evaluate(
      () =>
        (window as unknown as { postPageAnimations: { duration: number; frames: { transform: string }[] }[] })
          .postPageAnimations,
    )
    expect(animations).toHaveLength(1)
    expect(animations[0]!.duration).toBe(mode === 'fade' ? 140 : 160)
    expect(animations[0]!.frames[0]!.transform).toBe(mode === 'fade' ? 'translateY(0px)' : 'translateY(-6px)')
  })
}

test('分页动画进行中开启减少动态效果会立即收尾', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL!, 'nexus', 'normal')
  await page.getByRole('button', { name: '2', exact: true }).click()
  await page.waitForFunction(() =>
    document
      .querySelector('.post-list')
      ?.getAnimations()
      .some((a) => a.playState === 'running'),
  )
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await assertSettled(page, 2)
})
