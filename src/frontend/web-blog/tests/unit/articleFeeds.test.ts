// @vitest-environment node
/** @file articleFeeds.test.ts @description 文章三种订阅的真实路由、公开数据读取、格式与 HTTP 缓存契约。 */
import { createRequire } from 'node:module'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { Window } from 'happy-dom'
import type { EventHandler } from 'h3'
import type { PostItem } from '~/features/post/types'

/** 摘要作为 HTML 片段展示时的纯文本形式：独立列出转义规则，不复用实现 */
function summaryAsHtmlText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const require = createRequire(import.meta.url)
const h3 = createRequire(require.resolve('nuxt/package.json'))('h3') as typeof import('h3')
const runtimeConfig = vi.hoisted(() => ({
  apiBaseUrl: 'https://api.example.test/api/v1',
  public: { siteUrl: 'https://blog.example.test/' } as { siteUrl: string; i18n?: { defaultLocale?: string } },
}))
mockNuxtImport('useRuntimeConfig', () => () => runtimeConfig)

const window = new Window()
const parseXml = (body: string) => new window.DOMParser().parseFromString(body, 'application/xml')
const atomNamespace = 'http://www.w3.org/2005/Atom'
const site = 'https://blog.example.test'
const published = '2026-10-10T08:30:00.000Z'
const revised = '2026-10-12T09:45:00.000Z'
const formats = [
  { format: 'rss', path: '/rss.xml', contentType: 'application/rss+xml' },
  { format: 'atom', path: '/atom.xml', contentType: 'application/atom+xml' },
  { format: 'json', path: '/feed.json', contentType: 'application/feed+json' },
] as const
type FeedFormat = (typeof formats)[number]['format']
const handlers = {} as Record<FeedFormat, EventHandler>
let posts: PostItem[]
let settings: { name: string; description: string; ownerName: string; updatedAt?: string }
let details: Record<string, { id: string; title: string; contentRaw?: string; updatedAt?: string }>
let unavailablePaths: Set<string>

const fetchPublic = vi.fn(async (input: string, _options?: Record<string, unknown>) => {
  const path = input.slice(runtimeConfig.apiBaseUrl.length)
  if (unavailablePaths.has(path)) throw new Error('上游暂不可用')
  if (path === '/site') return { code: 0, data: settings }
  if (path === '/posts?pageSize=20&pinnedFirst=false') {
    return { code: 0, data: { items: posts, total: posts.length, page: 1, pageSize: 20 } }
  }
  if (path.startsWith('/posts/')) {
    const detail = details[path.slice('/posts/'.length)]
    if (detail) return { code: 0, data: detail }
  }
  throw new Error(`未声明的公开请求：${path}`)
})

// 只替换 Nitro 的存储包装；每次实际执行生产数据读取与 Markdown 渲染，不访问磁盘缓存或网络。
const cachedFunction = vi.fn(
  (
    callback: (...args: unknown[]) => unknown,
    _options?: { name: string; maxAge: number; getKey: (event: unknown, id: string) => string },
  ) => callback,
)
function installGlobals() {
  for (const [key, value] of Object.entries(h3)) vi.stubGlobal(key, value)
  vi.stubGlobal('$fetch', fetchPublic)
  vi.stubGlobal('defineCachedFunction', cachedFunction)
}

beforeAll(async () => {
  installGlobals()
  handlers.rss = (await import('../../server/routes/rss.xml')).default
  handlers.atom = (await import('../../server/routes/atom.xml')).default
  handlers.json = (await import('../../server/routes/feed.json')).default
  // Vitest 会自动导入页面版同名函数；加载后替换为真实 H3，避免提前加载 Nuxt 模块影响运行配置替身。
  vi.spyOn(await import('#app/composables/ssr'), 'setResponseStatus').mockImplementation(h3.setResponseStatus)
})

beforeEach(() => {
  installGlobals()
  fetchPublic.mockClear()
  unavailablePaths = new Set()
  runtimeConfig.apiBaseUrl = 'https://api.example.test/api/v1'
  runtimeConfig.public.siteUrl = `${site}/`
  settings = {
    name: '行走 & 记录 <博客>',
    description: '技术、生活与 "灵感"',
    ownerName: '小新 & 朋友',
    updatedAt: '2026-10-11T00:00:00.000Z',
  }
  posts = [
    {
      id: 42,
      slug: '周末 & 小记',
      title: '雨后 <街道> & 日光 "新篇"',
      summary: '沿街走走 & 看看 <树影>',
      folder: '生活 & 观察',
      tags: [{ label: '城市 <散步>', color: 'emerald' }],
      category: 'life',
      readTime: 3,
      likes: 0,
      views: 0,
      comments: 0,
      date: published,
    },
  ]
  details = {
    '42': {
      id: '42',
      title: posts[0]!.title,
      contentRaw:
        '雨后的 **街道**。\n\n[归档](/archive?year=2026&page=2)\n\n![树影](./street.jpg)\n\n<script>alert(1)</script>\n\n]]>',
      updatedAt: revised,
    },
  }
})
afterEach(() => vi.unstubAllGlobals())
afterAll(() => {
  vi.restoreAllMocks()
  window.happyDOM.close()
})

async function requestFeed(format: FeedFormat, init: RequestInit = {}) {
  const path = formats.find((entry) => entry.format === format)!.path
  const app = h3.createApp().use(handlers[format])
  // 内存 Web 适配器保留 H3 的 HEAD/错误响应处理，无需监听任何端口。
  return h3.toWebHandler(app)(new Request(`${site}${path}`, init))
}

describe('文章订阅格式', () => {
  it('正文与修订时间共用十分钟缓存，并以文章编号作为缓存键', () => {
    const options = cachedFunction.mock.calls.find(([, options]) => options?.name === 'feed-article-content')?.[1]
    expect(options).toMatchObject({ name: 'feed-article-content', maxAge: 600 })
    expect(options!.getKey({}, '42')).toBe('42')
    expect(options!.getKey({}, '43')).toBe('43')
  })

  it('共享数据读取最多同时请求四篇详情，完成顺序不改变公开列表顺序', async () => {
    const first = posts[0]!
    posts = Array.from({ length: 7 }, (_, index) => ({ ...first, id: 42 + index, title: `散步手记 ${index + 1}` }))
    details = Object.fromEntries(
      posts.map((post) => [String(post.id), { id: String(post.id), title: post.title, contentRaw: '街道与树影。' }]),
    )
    const original = fetchPublic.getMockImplementation()!
    let active = 0
    let maximum = 0
    fetchPublic.mockImplementation(async (...args) => {
      if (!/\/posts\/\d+$/.test(args[0])) return original(...args)
      active++
      maximum = Math.max(maximum, active)
      // 第一个条目稍后完成，以覆盖并发完成顺序与输出顺序不同的情况。
      if (args[0].endsWith('/42')) await Promise.resolve()
      await Promise.resolve()
      const result = await original(...args)
      active--
      return result
    })
    try {
      const feed = await (await requestFeed('json')).json()
      expect(maximum).toBe(4)
      expect(feed.items.map((item: { id: string }) => item.id)).toEqual(
        posts.map((post) => `${site}/articles/${post.id}`),
      )
    } finally {
      fetchPublic.mockImplementation(original)
    }
  })

  it('RSS 保留稳定数字 GUID、摘要、分类、作者和安全全文', async () => {
    const response = await requestFeed('rss')
    const body = await response.text()
    const document = parseXml(body)
    expect(document.querySelector('parsererror')).toBeNull()
    expect(document.documentElement.tagName).toBe('rss')
    expect(document.documentElement.getAttribute('version')).toBe('2.0')
    expect(document.querySelector('channel > title')?.textContent).toBe(settings.name)
    const item = document.querySelector('item')!
    expect(item.querySelector('title')?.textContent).toBe(posts[0]!.title)
    expect(item.querySelector('link')?.textContent).toBe(`${site}/articles/${encodeURIComponent(posts[0]!.slug!)}`)
    expect(item.querySelector('guid')?.textContent).toBe(`${site}/articles/42`)
    // RSS 阅读器把 description 当 HTML 展示，摘要先按纯文本转义，解析后仍是转义形式。
    expect(item.querySelector('description')?.textContent).toBe(summaryAsHtmlText(posts[0]!.summary))
    expect(item.querySelector('pubDate')?.textContent).toBe(new Date(published).toUTCString())
    // happy-dom 的命名空间检索未返回带前缀元素，按限定名读取并独立核对命名空间。
    const creator = item.getElementsByTagName('dc:creator')[0]!
    expect(creator.namespaceURI).toBe('http://purl.org/dc/elements/1.1/')
    expect(creator.textContent).toBe(settings.ownerName)
    expect([...item.querySelectorAll('category')].map((entry) => entry.textContent)).toEqual([
      posts[0]!.folder,
      posts[0]!.tags[0]!.label,
    ])
    const content = item.getElementsByTagName('content:encoded')[0]!
    expect(content.namespaceURI).toBe('http://purl.org/rss/1.0/modules/content/')
    const html = content.textContent
    expect(html).toContain('<strong>街道</strong>')
    expect(html).toContain(`href="${site}/archive?year=2026&amp;page=2"`)
    expect(html).toContain(`src="${site}/articles/street.jpg"`)
    expect(html).not.toContain('<script>')
    expect(body).not.toContain('<![CDATA[')
    expect(document.querySelector('lastBuildDate')?.textContent).toBe(new Date(revised).toUTCString())
  })

  it('Atom 1.0 包含命名空间、必需字段、作者及可解析的转义 HTML', async () => {
    const response = await requestFeed('atom')
    const body = await response.text()
    const document = parseXml(body)
    expect(document.querySelector('parsererror')).toBeNull()
    const feed = document.documentElement
    expect(feed.tagName).toBe('feed')
    expect(feed.namespaceURI).toBe(atomNamespace)
    expect(feed.querySelector(':scope > title')?.textContent).toBe(settings.name)
    expect(feed.querySelector(':scope > id')?.textContent).toBeTruthy()
    expect(feed.querySelector(':scope > updated')?.textContent).toBe(revised)
    expect(feed.querySelector(':scope > author > name')?.textContent).toBe(settings.ownerName)
    expect(feed.querySelector('link[rel="self"]')?.getAttribute('href')).toBe(`${site}/atom.xml`)
    expect(feed.querySelector('link[rel="self"]')?.getAttribute('type')).toBe('application/atom+xml')
    const entry = feed.querySelector('entry')!
    expect(entry.namespaceURI).toBe(atomNamespace)
    expect(entry.querySelector('id')?.textContent).toBe(`${site}/articles/42`)
    expect(entry.querySelector('title')?.textContent).toBe(posts[0]!.title)
    expect(entry.querySelector('link')?.getAttribute('href')).toBe(
      `${site}/articles/${encodeURIComponent(posts[0]!.slug!)}`,
    )
    expect(entry.querySelector('published')?.textContent).toBe(published)
    expect(entry.querySelector('updated')?.textContent).toBe(revised)
    expect(entry.querySelector('summary')?.textContent).toBe(posts[0]!.summary)
    expect(entry.querySelector('content')?.getAttribute('type')).toBe('html')
    expect(entry.querySelector('content')?.children).toHaveLength(0)
    const html = entry.querySelector('content')!.textContent
    expect(html).toContain('<strong>街道</strong>')
    expect(html).toContain(`href="${site}/archive?year=2026&amp;page=2"`)
    expect(html).toContain(`src="${site}/articles/street.jpg"`)
    expect(html).not.toContain('<script>')
    expect(body).not.toContain('<![CDATA[')
  })

  it('JSON Feed 1.1 输出安全全文、绝对 URL、独立发布时间和修订时间', async () => {
    const feed = await (await requestFeed('json')).json()
    expect(feed).toMatchObject({
      version: 'https://jsonfeed.org/version/1.1',
      title: settings.name,
      home_page_url: `${site}/`,
      feed_url: `${site}/feed.json`,
      description: settings.description,
      authors: [{ name: settings.ownerName }],
    })
    expect(feed.items).toHaveLength(1)
    expect(feed.items[0]).toMatchObject({
      id: `${site}/articles/42`,
      url: `${site}/articles/${encodeURIComponent(posts[0]!.slug!)}`,
      title: posts[0]!.title,
      summary: posts[0]!.summary,
      date_published: published,
      date_modified: revised,
    })
    expect(feed.items[0].content_html).toContain('<strong>街道</strong>')
    expect(feed.items[0].content_html).toContain(`href="${site}/archive?year=2026&amp;page=2"`)
    expect(feed.items[0].content_html).toContain(`src="${site}/articles/street.jpg"`)
    expect(feed.items[0].content_html).not.toContain('<script>')
  })

  it('正文缺失和详情失败均回退摘要，旧于发布的修订时间不倒退', async () => {
    details['42']!.contentRaw = undefined
    details['42']!.updatedAt = '2020-01-01T00:00:00.000Z'
    for (const failure of [false, true]) {
      if (failure) unavailablePaths.add('/posts/42')
      const atom = parseXml(await (await requestFeed('atom')).text())
      expect(atom.querySelector('entry > summary')?.textContent).toBe(posts[0]!.summary)
      expect(atom.querySelector('entry > updated')?.textContent).toBe(published)
      const json = await (await requestFeed('json')).json()
      expect(json.items[0].content_html).toBeUndefined()
      expect(json.items[0].content_text).toBe(posts[0]!.summary)
      expect(json.items[0].date_modified).toBe(failure ? undefined : published)
      const rss = parseXml(await (await requestFeed('rss')).text())
      expect(rss.querySelector('item > description')?.textContent).toBe(summaryAsHtmlText(posts[0]!.summary))
      expect(rss.getElementsByTagName('content:encoded')).toHaveLength(0)
    }
  })

  it('缺少详情修订时间时 JSON 省略可选字段，Atom 必需时间回退发布时间', async () => {
    details['42']!.updatedAt = undefined
    const json = await (await requestFeed('json')).json()
    expect(json.items[0]).not.toHaveProperty('date_modified')
    expect(json.items[0].date_published).toBe(published)
    const atom = parseXml(await (await requestFeed('atom')).text())
    expect(atom.querySelector('entry > updated')?.textContent).toBe(published)
  })

  it('文章改 slug 后只改变浏览地址，Atom 与 JSON 标识保持不变', async () => {
    const initialJson = await (await requestFeed('json')).json()
    const initialAtom = parseXml(await (await requestFeed('atom')).text())
    posts[0]!.slug = 'another-walk'
    const nextJson = await (await requestFeed('json')).json()
    const nextAtom = parseXml(await (await requestFeed('atom')).text())
    expect(nextJson.items[0].id).toBe(initialJson.items[0].id)
    expect(nextJson.items[0].url).toBe(`${site}/articles/another-walk`)
    expect(nextAtom.querySelector('entry > id')?.textContent).toBe(initialAtom.querySelector('entry > id')?.textContent)
    expect(nextAtom.querySelector('entry > link')?.getAttribute('href')).toBe(`${site}/articles/another-walk`)
    posts[0]!.slug = undefined
    const numeric = await (await requestFeed('json')).json()
    expect(numeric.items[0].url).toBe(`${site}/articles/42`)
  })
})

describe('文章订阅语言跟随站点默认语言', () => {
  afterEach(() => {
    delete runtimeConfig.public.i18n
  })

  async function feedLanguages() {
    const rss = parseXml(await (await requestFeed('rss')).text())
    const atom = parseXml(await (await requestFeed('atom')).text())
    const json = await (await requestFeed('json')).json()
    return [
      rss.querySelector('channel > language')?.textContent,
      atom.documentElement.getAttribute('xml:lang'),
      json.language,
    ]
  }

  it('未配置或配置无效时三种格式均为中文', async () => {
    expect(await feedLanguages()).toEqual(['zh-CN', 'zh-CN', 'zh-CN'])
    runtimeConfig.public.i18n = { defaultLocale: 'fr' }
    expect(await feedLanguages()).toEqual(['zh-CN', 'zh-CN', 'zh-CN'])
  })

  it('站点默认英文时三种格式均声明英文，站点资料与文章内容不翻译', async () => {
    runtimeConfig.public.i18n = { defaultLocale: 'en' }
    expect(await feedLanguages()).toEqual(['en', 'en', 'en'])
    const json = await (await requestFeed('json')).json()
    expect(json.title).toBe(settings.name)
    expect(json.items[0].title).toBe(posts[0]!.title)
  })
})

describe.each(formats)('$format 公开读取与响应缓存', ({ format, contentType }) => {
  it('只请求最新公开文章、公共站点与详情，不转发访客身份', async () => {
    const response = await requestFeed(format, { headers: { cookie: 'private=secret', authorization: 'Bearer token' } })
    expect(response.status, await response.clone().text()).toBe(200)
    expect(response.headers.get('content-type')).toBe(`${contentType}; charset=utf-8`)
    expect(response.headers.get('cache-control')).toBe('public, max-age=300')
    expect(response.headers.get('last-modified')).toBe(new Date(revised).toUTCString())
    expect(response.headers.get('etag')).toMatch(/^W\/".+"$/)
    expect(fetchPublic.mock.calls.map(([url]) => url).sort()).toEqual(
      ['/posts?pageSize=20&pinnedFirst=false', '/site', '/posts/42']
        .map((path) => `${runtimeConfig.apiBaseUrl}${path}`)
        .sort(),
    )
    for (const call of fetchPublic.mock.calls) {
      expect(call[1]).toMatchObject({ method: 'GET', credentials: 'omit', cache: 'no-store', retry: 0 })
      expect(call[1]).not.toHaveProperty('headers')
    }
  })

  it('空文章列表仍是合法且稳定的订阅，缺少站点时间时不使用当前时间', async () => {
    posts = []
    settings.updatedAt = undefined
    const response = await requestFeed(format)
    const body = await response.text()
    expect(response.status).toBe(200)
    expect(response.headers.get('last-modified')).toBe(new Date(0).toUTCString())
    if (format === 'json') expect(JSON.parse(body).items).toEqual([])
    else {
      const document = parseXml(body)
      expect(document.querySelector('parsererror')).toBeNull()
      expect(document.querySelectorAll(format === 'atom' ? 'entry' : 'item')).toHaveLength(0)
      if (format === 'atom') expect(document.querySelector('updated')?.textContent).toBe(new Date(0).toISOString())
    }
    const repeated = await requestFeed(format)
    expect(await repeated.text()).toBe(body)
    expect(repeated.headers.get('etag')).toBe(response.headers.get('etag'))
    expect(fetchPublic.mock.calls.some(([url]) => url.endsWith('/posts/42'))).toBe(false)
  })

  it.each(['/site', '/posts?pageSize=20&pinnedFirst=false'])('上游 %s 失败返回 503 且禁止缓存', async (path) => {
    unavailablePaths.add(path)
    const response = await requestFeed(format)
    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('etag')).toBeNull()
  })

  it('每次重新读取公开列表，已撤回文章不会因先前正文读取继续输出', async () => {
    const initial = await requestFeed(format)
    const etag = initial.headers.get('etag')!
    posts = []
    fetchPublic.mockClear()
    const withdrawn = await requestFeed(format, { headers: { 'if-none-match': etag } })
    const body = await withdrawn.text()
    expect(withdrawn.status).toBe(200)
    expect(withdrawn.headers.get('etag')).not.toBe(etag)
    if (format === 'json') expect(JSON.parse(body).items).toEqual([])
    else expect(parseXml(body).querySelectorAll(format === 'atom' ? 'entry' : 'item')).toHaveLength(0)
    expect(fetchPublic.mock.calls.map(([url]) => url).sort()).toEqual(
      ['/posts?pageSize=20&pinnedFirst=false', '/site'].map((path) => `${runtimeConfig.apiBaseUrl}${path}`).sort(),
    )
  })

  it('If-None-Match 优先于时间条件，支持弱/强标签、列表与通配符', async () => {
    const initial = await requestFeed(format)
    const etag = initial.headers.get('etag')!
    for (const condition of [etag, etag.replace(/^W\//, ''), `"other", ${etag}`, '*']) {
      const response = await requestFeed(format, { headers: { 'if-none-match': condition } })
      expect(response.status).toBe(304)
      expect(await response.text()).toBe('')
      expect(response.headers.get('etag')).toBe(etag)
    }
    const different = await requestFeed(format, {
      headers: { 'if-none-match': '"different"', 'if-modified-since': 'Thu, 01 Jan 2099 00:00:00 GMT' },
    })
    expect(different.status).toBe(200)
    expect(await different.text()).not.toBe('')
    const sameDate = await requestFeed(format, {
      headers: { 'if-modified-since': initial.headers.get('last-modified')! },
    })
    expect(sameDate.status).toBe(304)
    expect(await sameDate.text()).toBe('')
    for (const date of ['invalid-date', new Date(0).toUTCString()]) {
      expect((await requestFeed(format, { headers: { 'if-modified-since': date } })).status).toBe(200)
    }
  })

  it('HEAD 保留 GET 缓存头和条件响应且无正文，其他方法拒绝并禁止缓存', async () => {
    const initial = await requestFeed(format)
    const etag = initial.headers.get('etag')!
    const head = await requestFeed(format, { method: 'HEAD' })
    expect(head.status).toBe(200)
    expect(head.headers.get('etag')).toBe(etag)
    expect(head.headers.get('content-type')).toBe(initial.headers.get('content-type'))
    expect(await head.text()).toBe('')
    const conditional = await requestFeed(format, { method: 'HEAD', headers: { 'if-none-match': etag } })
    expect(conditional.status).toBe(304)
    expect(await conditional.text()).toBe('')
    fetchPublic.mockClear()
    const rejected = await requestFeed(format, { method: 'POST' })
    expect(rejected.status).toBe(405)
    expect(rejected.headers.get('cache-control')).toBe('no-store')
    expect(fetchPublic).not.toHaveBeenCalled()
  })

  it('正文或站点资料变更使 ETag 失效，即使发布时间不变', async () => {
    const initial = await requestFeed(format)
    const etag = initial.headers.get('etag')!
    details['42']!.contentRaw = '街角的小店重新开门了。'
    const changedBody = await requestFeed(format, { headers: { 'if-none-match': etag } })
    expect(changedBody.status).toBe(200)
    expect(changedBody.headers.get('etag')).not.toBe(etag)
    settings.name = '另一段旅程'
    const changedSite = await requestFeed(format, { headers: { 'if-none-match': changedBody.headers.get('etag')! } })
    expect(changedSite.status).toBe(200)
    expect(changedSite.headers.get('etag')).not.toBe(changedBody.headers.get('etag'))
  })
})
