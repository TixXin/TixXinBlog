/** @file hydration-history.spec.ts @description 首页及内容列表快速刷新与原生历史导航，核对SSR、API与历史槽位 */
import { expect, test } from '@playwright/test'
import type { Page, TestInfo } from '@playwright/test'
import { prepareMotionCapture, captureMotion } from './motionScreenshot'
test.beforeEach(({ page, browserName }) => prepareMotionCapture(page, browserName))

test('首页分页早期返回后正确接管SSR列表，往返保留真实历史槽位', async ({ page, context, baseURL }, testInfo) => {
  const issues: string[] = []
  page.on('pageerror', (error) => issues.push(error.message))
  page.on('console', (message) => {
    if (/hydration|NotFoundError|TypeError|ReferenceError|Unhandled/i.test(message.text())) issues.push(message.text())
  })
  await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: 'nexus', url: baseURL! }])
  await page.setViewportSize({ width: 390, height: 960 })
  await page.addInitScript(() => {
    addEventListener('popstate', () => {
      const key = 'post-early-history'
      const events = JSON.parse(sessionStorage.getItem(key) ?? '[]') as unknown[]
      events.push({
        path: location.pathname + location.search,
        ready: document.documentElement?.classList.contains('app-client-ready') ?? false,
      })
      sessionStorage.setItem(key, JSON.stringify(events))
    })
  })
  const cards = page.locator('.post-list a[href^="/articles/"]')
  const ids = () =>
    cards.evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('href')?.split('/').at(-1))))
  await page.goto('/?mode=paginated')
  await expect(page.locator('html')).toHaveClass(/app-client-ready/)
  const firstUrl = new URL(page.url()).pathname + new URL(page.url()).search
  const firstResponse = await page.request.get('/api/v1/posts?page=1&pageSize=15')
  const secondResponse = await page.request.get('/api/v1/posts?page=2&pageSize=15')
  expect(firstResponse.status()).toBe(200)
  expect(secondResponse.status()).toBe(200)
  const first = (await firstResponse.json()).data as { items: { id: number }[] }
  const second = (await secondResponse.json()).data as { items: { id: number }[] }
  const firstIds = first.items.map((item) => item.id),
    secondIds = second.items.map((item) => item.id)
  expect(firstIds).toHaveLength(15)
  expect(secondIds).toHaveLength(15)
  await expect.poll(ids).toEqual(firstIds)
  const ssr = await page.request.get('/?mode=paginated&page=2')
  expect(ssr.status()).toBe(200)
  const ssrIds = await page.evaluate(
    (html) =>
      [...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('.post-list a[href^="/articles/"]')].map(
        (node) => Number(node.getAttribute('href')?.split('/').at(-1)),
      ),
    await ssr.text(),
  )
  expect(ssrIds).toEqual(secondIds)
  await page.getByRole('button', { name: '2', exact: true }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect.poll(ids).toEqual(secondIds)
  // 返回从文档commit后立即发起；在第一页核查水合结果，不能先前进掩盖首帧空VNode。
  await page.reload({ waitUntil: 'commit' })
  await page.goBack({ waitUntil: 'commit' })
  await expect(page).toHaveURL((url) => url.pathname + url.search === firstUrl)
  await expect(page.locator('html')).toHaveClass(/app-client-ready/)
  await expect.poll(ids).toEqual(firstIds)
  await page.goForward({ waitUntil: 'commit' })
  await expect(page).toHaveURL(/page=2/)
  await expect.poll(ids).toEqual(secondIds)
  await page.goBack({ waitUntil: 'commit' })
  await expect(page).toHaveURL((url) => url.pathname + url.search === firstUrl)
  await expect.poll(ids).toEqual(firstIds)
  await page.goForward({ waitUntil: 'commit' })
  await expect(page).toHaveURL(/page=2/)
  await expect.poll(ids).toEqual(secondIds)
  expect(issues).toEqual([])
  await testInfo.attach('post-early-history.json', {
    body: JSON.stringify({
      firstIds,
      secondIds,
      ssrIds,
      issues,
      observations: await page.evaluate(() => JSON.parse(sessionStorage.getItem('post-early-history') ?? '[]')),
    }),
    contentType: 'application/json',
  })
})

interface HistoryObservation {
  event: string
  url: string
  clientReady: boolean
  readyState: string
  at: number
}
async function rapidReloadAndHistory(
  page: Page,
  options: { path: string; card: string; pagination: string },
  testInfo: TestInfo,
) {
  const issues: string[] = []
  page.on('pageerror', (error) => issues.push(error.message))
  page.on('console', (message) => {
    if (/hydration|NotFoundError|TypeError|ReferenceError|RangeError|SyntaxError|Unhandled/i.test(message.text()))
      issues.push(message.text())
  })
  await page.addInitScript(() => {
    const record = (event: string) => {
      const key = '__e2e_rapid_history_observations'
      const observations = JSON.parse(sessionStorage.getItem(key) ?? '[]') as HistoryObservation[]
      observations.push({
        event,
        url: location.href,
        clientReady: document.documentElement?.classList.contains('app-client-ready') ?? false,
        readyState: document.readyState,
        at: Date.now(),
      })
      sessionStorage.setItem(key, JSON.stringify(observations))
    }
    record('document-created')
    addEventListener('DOMContentLoaded', () => record('domcontentloaded'))
    addEventListener('load', () => record('load'))
    addEventListener('popstate', () => record('popstate'))
    addEventListener('pageshow', () => record('pageshow'))
  })
  await page.goto(options.path)
  await expect(page.locator('html')).toHaveClass(/app-client-ready/)
  const firstResponse = await page.request.get(`/api/v1${options.path}?page=1&pageSize=12`)
  expect(firstResponse.status()).toBe(200)
  const firstPage = (await firstResponse.json()).data as { items: { id: number }[] }
  expect(firstPage.items.length).toBeGreaterThan(0)
  const secondResponse = await page.request.get(`/api/v1${options.path}?page=2&pageSize=12`)
  expect(secondResponse.status()).toBe(200)
  const secondPage = (await secondResponse.json()).data as { items: { id: number }[] }
  expect(secondPage.items.length).toBeGreaterThan(0)
  await page
    .getByRole('navigation', { name: options.pagination, exact: true })
    .getByRole('button', { name: '下一页', exact: true })
    .click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.locator(options.card)).toHaveCount(secondPage.items.length)
  await page.evaluate(() => sessionStorage.removeItem('__e2e_rapid_history_observations'))
  const startedAt = Date.now(),
    timings: { event: string; elapsedMs: number; url: string }[] = []
  // 从 commit 起立即操作浏览器历史，不等待 ready、控件启用、动画或任何人为延时。
  await page.reload({ waitUntil: 'commit' })
  timings.push({ event: 'reload-committed', elapsedMs: Date.now() - startedAt, url: page.url() })
  await page.goBack({ waitUntil: 'commit' })
  timings.push({ event: 'back-returned', elapsedMs: Date.now() - startedAt, url: page.url() })
  await expect(page).not.toHaveURL(/page=2/)
  timings.push({ event: 'back-url-observed', elapsedMs: Date.now() - startedAt, url: page.url() })
  await page.goForward({ waitUntil: 'commit' })
  timings.push({ event: 'forward-returned', elapsedMs: Date.now() - startedAt, url: page.url() })
  await expect(page).toHaveURL(/page=2/)
  timings.push({ event: 'forward-url-observed', elapsedMs: Date.now() - startedAt, url: page.url() })
  await page.waitForLoadState('domcontentloaded')
  const observations = await page.evaluate(
    () => JSON.parse(sessionStorage.getItem('__e2e_rapid_history_observations') ?? '[]') as HistoryObservation[],
  )
  const evidence = {
    issues,
    timings,
    observations,
    observedUnreadyHistory: observations.some((item) => item.event === 'popstate' && !item.clientReady),
    secondPageIds: secondPage.items.map((item) => item.id),
  }
  await testInfo.attach('rapid-history-observations.json', {
    body: Buffer.from(JSON.stringify(evidence)),
    contentType: 'application/json',
  })
  await expect(page.locator('html')).toHaveClass(/app-client-ready/)
  await expect(page.locator(options.card)).toHaveCount(secondPage.items.length)
  // 瞬时出现第一页还不足以证明历史完整：启动回放可能随后覆盖该槽位。
  await page.goBack({ waitUntil: 'commit' })
  await expect(page).toHaveURL((url) => url.pathname === options.path && !url.searchParams.has('page'))
  await expect(page.locator(options.card)).toHaveCount(firstPage.items.length)
  const cardIds = () =>
    page.locator(options.card).evaluateAll((cards) =>
      cards.map((card) => {
        const element = card as HTMLElement
        return Number(
          element.dataset.linkId ||
            element.dataset.projectId ||
            element.dataset.focusKey?.replace('gallery-photo-', ''),
        )
      }),
    )
  await expect.poll(cardIds).toEqual(firstPage.items.map((item) => item.id))
  timings.push({ event: 'first-history-slot-preserved', elapsedMs: Date.now() - startedAt, url: page.url() })
  await page.goForward({ waitUntil: 'commit' })
  await expect(page).toHaveURL(/page=2/)
  await expect(page.locator(options.card)).toHaveCount(secondPage.items.length)
  await expect.poll(cardIds).toEqual(secondPage.items.map((item) => item.id))
  return evidence
}
for (const width of [390, 768, 1280, 1439]) {
  test(`项目快速刷新与原生历史切换 ${width}px 不丢列表或产生水合错误`, async ({ page, context, baseURL }, testInfo) => {
    await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: 'nexus', url: baseURL! }])
    await page.setViewportSize({ width, height: 960 })
    const evidence = await rapidReloadAndHistory(
      page,
      {
        path: '/projects',
        card: '.project-card',
        pagination: '项目分页',
      },
      testInfo,
    )
    const read = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/v1/projects' &&
        new URL(response.url()).searchParams.get('progress') === 'active',
    )
    await page.getByRole('combobox', { name: '筛选项目进展', exact: true }).selectOption('active')
    const response = await read
    expect(response.status()).toBe(200)
    const data = (await response.json()).data as { items: { id: number }[]; total: number }
    expect(data.total).toBeGreaterThan(0)
    await expect(page.locator('.project-card')).toHaveCount(data.items.length)
    expect(
      await page
        .locator('.project-card')
        .evaluateAll((cards) => cards.map((card) => Number((card as HTMLElement).dataset.projectId))),
    ).toEqual(data.items.map((item) => item.id))
    expect(evidence.issues).toEqual([])
    await testInfo.attach('hydration-history.json', {
      body: Buffer.from(JSON.stringify({ ...evidence, activeIds: data.items.map((item) => item.id) })),
      contentType: 'application/json',
    })
    if (width === 390) await captureMotion(page, testInfo, 'project-hydration-history.png')
  })
}
test('图库快速刷新与原生历史切换不丢照片，后续搜索与API一致', async ({ page, context, baseURL }, testInfo) => {
  await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: 'nexus', url: baseURL! }])
  await page.setViewportSize({ width: 390, height: 960 })
  const evidence = await rapidReloadAndHistory(
    page,
    {
      path: '/gallery',
      card: '.gallery-item',
      pagination: '图库分页',
    },
    testInfo,
  )
  const photo = (await (await page.request.get('/api/v1/gallery?page=1&pageSize=1')).json()).data.items[0] as {
    title: string
  }
  const read = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/gallery' &&
      new URL(response.url()).searchParams.get('q') === photo.title,
  )
  await page.getByRole('textbox', { name: '搜索画廊照片', exact: true }).fill(photo.title)
  const response = await read
  expect(response.status()).toBe(200)
  const data = (await response.json()).data as { items: { id: number }[] }
  expect(data.items.length).toBeGreaterThan(0)
  await expect(page.locator('.gallery-item')).toHaveCount(data.items.length)
  expect(
    await page
      .locator('.gallery-item')
      .evaluateAll((cards) =>
        cards.map((card) => Number((card as HTMLElement).dataset.focusKey?.replace('gallery-photo-', ''))),
      ),
  ).toEqual(data.items.map((item) => item.id))
  expect(evidence.issues).toEqual([])
  await testInfo.attach('hydration-history.json', {
    body: Buffer.from(JSON.stringify(evidence)),
    contentType: 'application/json',
  })
})
test('友链快速刷新与原生历史切换不丢记录，后续推荐筛选与API一致', async ({ page, context, baseURL }, testInfo) => {
  await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: 'nexus', url: baseURL! }])
  await page.setViewportSize({ width: 390, height: 960 })
  const evidence = await rapidReloadAndHistory(
    page,
    { path: '/links', card: '.link-card', pagination: '友链分页' },
    testInfo,
  )
  const read = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/links' &&
      new URL(response.url()).searchParams.get('featured') === 'true',
  )
  await page.getByRole('combobox', { name: '筛选推荐友链', exact: true }).selectOption('true')
  const response = await read
  expect(response.status()).toBe(200)
  const data = (await response.json()).data as { items: { id: number }[] }
  expect(data.items.length).toBeGreaterThan(0)
  await expect(page.locator('.link-card')).toHaveCount(data.items.length)
  expect(
    await page
      .locator('.link-card')
      .evaluateAll((cards) => cards.map((card) => Number((card as HTMLElement).dataset.linkId))),
  ).toEqual(data.items.map((item) => item.id))
  expect(evidence.issues).toEqual([])
  await testInfo.attach('hydration-history.json', {
    body: Buffer.from(JSON.stringify(evidence)),
    contentType: 'application/json',
  })
})
