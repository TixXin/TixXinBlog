/** @file performance-admin.spec.ts @description 当前生产后台基线：隔离内容、预热后三次就绪与资源体积、长文输入后续帧；不作前后收益声明。 */
import { expect, test } from '@playwright/test'
import type { Page, Request, Response } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { cpus, platform, arch } from 'node:os'

interface BrowserProbe {
  readyMs: number | null
  input?: Promise<{
    beforeInputMs: number
    inputMs: number
    secondFrameMs: number
    elapsedMs: number
    trusted: boolean
  }>
}
type ProbeWindow = Window & { __adminProbe: BrowserProbe }
const sentence = '记录写作时的观察、实现与验证，保留足够正文用于后台长表单测量。 English notes. '
let markdown = Array.from({ length: 80 }, (_, index) => `## 写作章节 ${index + 1}\n\n${sentence.repeat(9)}\n\n`).join(
  '',
)
while (Buffer.byteLength(markdown, 'utf8') < 80 * 1024) markdown += '\n' + sentence

async function sample(page: Page, path: string, body?: string) {
  const requests: { method: string; path: string; resourceType: string; bodyBytes: number }[] = []
  const failures: { method: string; path: string }[] = []
  const badApi: { path: string; status: number }[] = []
  const request = (value: Request) =>
    requests.push({
      method: value.method(),
      path: new URL(value.url()).pathname,
      resourceType: value.resourceType(),
      bodyBytes: value.postDataBuffer()?.length ?? 0,
    })
  const failed = (value: Request) => failures.push({ method: value.method(), path: new URL(value.url()).pathname })
  const response = (value: Response) => {
    const path = new URL(value.url()).pathname
    if (path.startsWith('/api/v1/') && value.status() >= 400) badApi.push({ path, status: value.status() })
  }
  page.on('request', request)
  page.on('requestfailed', failed)
  page.on('response', response)
  try {
    await page.goto(path, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => typeof (window as unknown as ProbeWindow).__adminProbe?.readyMs === 'number')
    await page.evaluate(
      () => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
    )
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const resources = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).filter(
        (item) => item.responseEnd > 0,
      )
      const totals = (values: PerformanceResourceTiming[]) => ({
        count: values.length,
        transferBytes: values.reduce((sum, item) => sum + item.transferSize, 0),
        encodedBodyBytes: values.reduce((sum, item) => sum + item.encodedBodySize, 0),
        decodedBodyBytes: values.reduce((sum, item) => sum + item.decodedBodySize, 0),
        zeroTransferCount: values.filter((item) => item.transferSize === 0).length,
      })
      const scripts = resources.filter((item) => new URL(item.name).pathname.endsWith('.js'))
      const api = resources.filter((item) => new URL(item.name).pathname.startsWith('/api/v1/'))
      return {
        readyMs: (window as unknown as ProbeWindow).__adminProbe.readyMs,
        domContentLoadedMs: navigation.domContentLoadedEventEnd,
        navigation: {
          transferBytes: navigation.transferSize,
          encodedBodyBytes: navigation.encodedBodySize,
          decodedBodyBytes: navigation.decodedBodySize,
        },
        resources: totals(resources),
        scripts: totals(scripts),
        api: totals(api),
        fontStatus: document.fonts.status,
        viewport: { width: innerWidth, height: innerHeight },
        rows: document.querySelectorAll('.admin-posts__table tbody tr').length,
        headings: document.querySelectorAll('.post-editor__preview .article-markdown h2').length,
      }
    })
    const requestSnapshot = requests.slice()
    expect(failures).toEqual([])
    expect(badApi).toEqual([])
    let input = null
    if (body !== undefined) {
      const textarea = page.getByRole('textbox', { name: 'Markdown 正文', exact: true })
      await expect(textarea).toHaveValue(body)
      await textarea.focus()
      await textarea.evaluate((element: HTMLTextAreaElement) =>
        element.setSelectionRange(element.value.length, element.value.length),
      )
      await page.evaluate(() => {
        const target = document.querySelector<HTMLTextAreaElement>('.post-editor__body textarea')!
        let before = 0
        ;(window as unknown as ProbeWindow).__adminProbe.input = new Promise((done) => {
          target.addEventListener(
            'beforeinput',
            () => {
              before = performance.now()
            },
            { once: true, capture: true },
          )
          target.addEventListener(
            'input',
            (event) => {
              const inputMs = performance.now()
              requestAnimationFrame(() =>
                requestAnimationFrame(() => {
                  const secondFrameMs = performance.now()
                  done({
                    beforeInputMs: before || inputMs,
                    inputMs,
                    secondFrameMs,
                    elapsedMs: secondFrameMs - (before || inputMs),
                    trusted: event.isTrusted,
                  })
                }),
              )
            },
            { once: true, capture: true },
          )
        })
      })
      await page.keyboard.insertText('补充一段观察。')
      input = await page.evaluate(() => (window as unknown as ProbeWindow).__adminProbe.input!)
      expect(input.trusted).toBe(true)
      await expect(textarea).toHaveValue(body + '补充一段观察。')
      // 测量完成后使用原生撤销还原正文；不把清空内容当作更快的样本。
      await textarea.press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+z`)
      await expect(textarea).toHaveValue(body)
    }
    return {
      path,
      ...metrics,
      requested: {
        count: requestSnapshot.length,
        bodyBytes: requestSnapshot.reduce((sum, item) => sum + item.bodyBytes, 0),
        methods: requestSnapshot.reduce<Record<string, number>>((result, item) => {
          result[item.method] = (result[item.method] ?? 0) + 1
          return result
        }, {}),
      },
      input,
    }
  } finally {
    page.off('request', request)
    page.off('requestfailed', failed)
    page.off('response', response)
  }
}

test('当前生产后台就绪与约80KiB长文输入基线', async ({ page, browser, browserName }, testInfo) => {
  expect(process.env.E2E_ISOLATED).toBe('true')
  expect(browserName).toBe('chromium')
  const login = await page.request.post('/api/v1/auth/login', {
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
  })
  expect(login.status()).toBe(200)
  const auth = (await login.json()).data
  const headers = { Authorization: `Bearer ${auth.accessToken}` }
  const before = await page.request.get('/api/v1/admin/posts?pageSize=20', { headers })
  expect(before.status()).toBe(200)
  const base = (await before.json()).data
  expect(base.total).toBeGreaterThanOrEqual(106)
  const created = await page.request.post('/api/v1/admin/posts', {
    headers,
    data: { title: '长文编辑性能观察', contentRaw: markdown, status: 'draft' },
  })
  expect(created.status()).toBe(201)
  const post = (await created.json()).data
  const after = (await (await page.request.get('/api/v1/admin/posts?pageSize=20', { headers })).json()).data
  expect(after.total).toBe(base.total + 1)
  expect(after.items).toHaveLength(20)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.addInitScript(
    ({ id, contentLength }) => {
      const state: BrowserProbe = { readyMs: null }
      ;(window as unknown as ProbeWindow).__adminProbe = state
      const check = () => {
        const path = location.pathname
        const ready =
          path === '/admin'
            ? document.querySelectorAll('.overview__stats strong').length === 11 &&
              !!document.querySelector('.operations-summary')?.textContent?.includes('最近备份完整性校验')
            : path === '/admin/posts'
              ? document.querySelectorAll('.admin-posts__table tbody tr').length === 20 &&
                !!document.querySelector<HTMLSelectElement>('[aria-label="文章状态"]') &&
                !document.querySelector('.admin-posts [role="status"]')?.textContent?.includes('正在加载文章')
              : path === `/admin/posts/${id}` &&
                !!document.querySelector<HTMLTextAreaElement>('.post-editor__body textarea') &&
                !document.querySelector<HTMLTextAreaElement>('.post-editor__body textarea')!.disabled &&
                document.querySelector<HTMLTextAreaElement>('.post-editor__body textarea')!.value.length ===
                  contentLength &&
                document.querySelectorAll('.post-editor__preview .article-markdown h2').length === 80
        if (ready) state.readyMs = performance.now()
        else requestAnimationFrame(check)
      }
      requestAnimationFrame(check)
    },
    { id: post.id, contentLength: markdown.length },
  )
  const samples: Record<string, Awaited<ReturnType<typeof sample>>[]> = {},
    warmups: Record<string, Awaited<ReturnType<typeof sample>>> = {}
  for (const [name, path] of [
    ['overview', '/admin'],
    ['postList', '/admin/posts'],
    ['longEditor', `/admin/posts/${post.id}`],
  ]) {
    warmups[name!] = await sample(page, path!, name === 'longEditor' ? markdown : undefined)
    samples[name!] = []
    for (let iteration = 0; iteration < 3; iteration++) {
      // 只清理本探针所属隔离账号/文章的恢复副本，确保每次都是相同的已保存长文状态。
      if (name === 'longEditor')
        await page.evaluate(
          (prefix) => {
            for (const key of Object.keys(localStorage)) if (key.startsWith(prefix)) localStorage.removeItem(key)
          },
          `tixxin-post-recovery:${encodeURIComponent(auth.user.id)}:${post.id}:`,
        )
      samples[name!]!.push(await sample(page, path!, name === 'longEditor' ? markdown : undefined))
    }
  }
  const result = {
    kind: 'current-admin-baseline',
    measuredAt: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: platform(),
      arch: arch(),
      cpu: cpus()[0]?.model,
      logicalCpus: cpus().length,
      browser: browser.version(),
      viewport: { width: 1440, height: 1000 },
      build: 'existing Nuxt production .output',
      cache:
        'same browser context; one warmup per page; browser HTTP/OS/database caches not cleared; no route interception; no CPU/network throttling',
      concurrentLoad: 'other host work was not isolated',
      readiness:
        'browser rAF detects real overview counts+maintenance, 20 table rows, or enabled full textarea+80 preview headings; resource snapshot two frames later',
      input:
        'trusted beforeinput/input to second rAF; includes reactive/render scheduling; no server-save latency or INP claim',
    },
    content: {
      postsBefore: base.total,
      postsAfter: after.total,
      renderedListPageSize: 20,
      markdownCharacters: markdown.length,
      markdownUtf8Bytes: Buffer.byteLength(markdown, 'utf8'),
      headings: 80,
    },
    warmups,
    samples,
  }
  await writeFile(testInfo.outputPath('admin-performance.json'), JSON.stringify(result, null, 2))
  const persisted = await page.request.get(`/api/v1/admin/posts/${post.id}`, { headers })
  expect((await persisted.json()).data.contentRaw).toBe(markdown)
})
