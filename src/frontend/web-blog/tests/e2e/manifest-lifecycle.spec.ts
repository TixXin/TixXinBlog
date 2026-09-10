/** @file manifest-lifecycle.spec.ts @description 真实刷新中取消旧文档清单预取，并验证当前页清单故障后的业务与刷新恢复 */
import { writeFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

interface ManifestObservation {
  event: string
  at: number
  document: number
  phase: string
  url: string
  status?: number
}
const observations = new WeakMap<Page, { events: ManifestObservation[]; errors: string[] }>()
test.beforeEach(async ({ page }) => {
  const record = { events: [] as ManifestObservation[], errors: [] as string[] }
  observations.set(page, record)
  const prefix = 'manifest-lifecycle:'
  page.on('pageerror', (error) => record.errors.push(error.message))
  page.on('console', (message) => {
    if (message.text().startsWith(prefix)) record.events.push(JSON.parse(message.text().slice(prefix.length)))
  })
  await page.addInitScript(
    ({ prefix }) => {
      let phase = 'active'
      const record = (event: string, status?: number) => {
        // eslint-disable-next-line no-console -- 卸载中的旧文档通过浏览器日志传回观测，不影响错误事件。
        console.debug(
          prefix +
            JSON.stringify({
              event,
              at: performance.timeOrigin + performance.now(),
              document: performance.timeOrigin,
              phase,
              url: location.href,
              status,
            }),
        )
      }
      for (const event of ['beforeunload', 'pagehide', 'pageshow'])
        addEventListener(
          event,
          () => {
            phase = event === 'pageshow' ? 'active' : event
            record(event)
          },
          true,
        )
      const originalFetch = window.fetch
      window.fetch = function (...args: Parameters<typeof fetch>) {
        const input = args[0]
        const url = new URL(
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
          location.href,
        )
        if (url.origin !== location.origin || !/^\/_nuxt\/builds\/meta\/[^/]+\.json$/.test(url.pathname))
          return originalFetch.apply(this, args)
        record('manifest-fetch')
        return originalFetch.apply(this, args).then(
          (response) => {
            record('manifest-response', response.status)
            return response
          },
          (error) => {
            record('manifest-rejected')
            throw error
          },
        )
      }
    },
    { prefix },
  )
})
test.afterEach(async ({ page }, testInfo) => {
  const path = testInfo.outputPath('manifest-observations.json')
  await writeFile(path, JSON.stringify(observations.get(page), null, 2))
  await testInfo.attach('manifest-observations', { path, contentType: 'application/json' })
})

test('真实刷新开始后旧文档不再预取清单，新文档仍正常读取', async ({ page }) => {
  const record = observations.get(page)!
  let holdingNavigation = false,
    heldRequests = 0
  let release!: () => void
  const navigationGate = new Promise<void>((resolve) => (release = resolve))
  await page.route('**/projects', async (route) => {
    if (holdingNavigation && route.request().isNavigationRequest()) {
      heldRequests++
      await navigationGate
    }
    await route.continue()
  })
  await page.goto('/projects')
  await expect(page.locator('html')).toHaveClass(/app-client-ready/)
  await expect(page.locator('.project-card')).toHaveCount(12)
  const originalDocument = await page.evaluate(() => performance.timeOrigin)
  expect(record.events.filter((event) => event.event === 'manifest-fetch')).toHaveLength(0)
  holdingNavigation = true
  const refreshed = page.reload({ waitUntil: 'commit' })
  try {
    await expect.poll(() => heldRequests).toBe(1)
    await expect
      .poll(() => record.events.some((event) => event.document === originalDocument && event.event === 'beforeunload'))
      .toBe(true)
    // 暂缓新 HTML，明确跨过 Nuxt 的 1000ms 预取期限，逼出旧文档的定时器；不是等待界面稳定。
    // 在 Node 侧计时，避免浏览器等待新文档时阻塞 evaluate，与导航门禁互相等待。
    await delay(1100)
    expect(
      record.events.filter((event) => event.document === originalDocument && event.event === 'manifest-fetch'),
    ).toHaveLength(0)
    expect(record.errors).toEqual([])
  } finally {
    release()
    await refreshed
  }
  await expect(page.locator('.project-card')).toHaveCount(12)
  await expect
    .poll(() =>
      record.events.some(
        (event) => event.document !== originalDocument && event.event === 'manifest-response' && event.status === 200,
      ),
    )
    .toBe(true)
  expect(record.errors).toEqual([])
})

test('当前页清单503不破坏业务，端点恢复后用户刷新能读取真实清单', async ({ page }) => {
  const record = observations.get(page)!
  let unavailable = true,
    failures = 0
  await page.route('**/_nuxt/builds/meta/*.json', async (route) => {
    if (unavailable) {
      failures++
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"清单暂不可用"}' })
    } else await route.continue()
  })
  await page.goto('/projects')
  await expect(page.locator('.project-card')).toHaveCount(12)
  await expect
    .poll(() => record.events.filter((event) => event.event === 'manifest-response' && event.status === 503).length)
    .toBe(2)
  expect(failures).toBe(2)
  expect(record.errors).toEqual([])
  unavailable = false
  await page.getByRole('link', { name: '画廊', exact: true }).first().click()
  await expect(page).toHaveURL(/\/gallery$/)
  await expect(page.locator('.gallery-item')).toHaveCount(12)
  expect(record.errors).toEqual([])
  await page.reload()
  await expect(page.locator('.gallery-item')).toHaveCount(12)
  await expect
    .poll(() => record.events.some((event) => event.event === 'manifest-response' && event.status === 200))
    .toBe(true)
  expect(record.errors).toEqual([])
})
