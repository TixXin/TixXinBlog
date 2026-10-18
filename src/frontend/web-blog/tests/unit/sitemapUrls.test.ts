// @vitest-environment node
/**
 * @file sitemapUrls.test.ts
 * @description 动态站点地图的公开过滤、分页、时间与分域故障策略，所有上游响应均在内存中构造
 */
import { IncomingMessage, ServerResponse } from 'node:http'
import { createRequire } from 'node:module'
import { Socket } from 'node:net'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'

const require = createRequire(import.meta.url)
const h3: typeof import('h3') = createRequire(require.resolve('nuxt/package.json'))('h3')
const runtimeConfig = vi.hoisted(() => ({ apiBaseUrl: 'https://api.example.test/api/v1' }))
mockNuxtImport('useRuntimeConfig', () => () => runtimeConfig)
mockNuxtImport(
  '$fetch',
  () =>
    (...args: Parameters<typeof upstream>) =>
      upstream(...args),
)
vi.mock('~/utils/articleMarkdown', () => ({ renderArticleMarkdown: vi.fn() }))

const data = new Map<string, unknown>()
const failures = new Set<string>()
const upstream = vi.fn<(url: string, options: Record<string, unknown>) => Promise<{ code: number; data: unknown }>>(
  async (url) => {
    const path = url.replace(runtimeConfig.apiBaseUrl, '')
    if (failures.has(path)) throw new Error('内部服务错误，不应泄露')
    if (!data.has(path)) throw new Error(`未声明的上游请求：${path}`)
    return { code: 0, data: data.get(path) }
  },
)
let handler: typeof import('../../server/api/__sitemap__/urls').default

function event() {
  // 只创建 H3 请求对象，不监听端口，也不连接任何服务。
  const request = new IncomingMessage(new Socket())
  request.url = '/api/__sitemap__/urls'
  request.method = 'GET'
  request.headers = { cookie: 'admin-session=private', authorization: 'Bearer private' }
  return h3.createEvent(request, new ServerResponse(request))
}

beforeEach(async () => {
  runtimeConfig.apiBaseUrl = 'https://api.example.test/api/v1'
  data.clear()
  failures.clear()
  upstream.mockClear()
  data.set('/posts/metadata', { archive: [] })
  data.set('/flashes?page=1&pageSize=100', { items: [], total: 0 })
  data.set('/moments?pinnedFirst=false&page=1&pageSize=50', { items: [], total: 0 })
  data.set('/moments/overview', { topics: [] })
  vi.stubGlobal('defineEventHandler', h3.defineEventHandler)
  vi.stubGlobal('createError', h3.createError)
  // sitemap 不读取文章全文；仅补足共享模块导入所需的 Nitro 包装器。
  vi.stubGlobal('defineCachedFunction', (callback: unknown) => callback)
  vi.stubGlobal('$fetch', upstream)
  handler = (await import('../../server/api/__sitemap__/urls')).default
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('动态 sitemap 来源', () => {
  it('过滤 noindex、草稿和归档，保留真实更新时间与旧文章发布日期后备', async () => {
    data.set('/posts/metadata', {
      archive: [
        { id: 1, slug: '中文 & 路径', date: '2026-01-01', updatedAt: '2026-10-01' },
        { id: 2, date: '2026-02-01' },
        { id: 3, slug: 'hidden', date: '2026-03-01', seoNoindex: true },
      ],
    })
    data.set('/flashes?page=1&pageSize=100', {
      items: [
        { id: 'note-1', createdAt: '2026-04-01', updatedAt: '2026-10-02' },
        { id: 'note-2', createdAt: '2026-05-01' },
        { id: 'draft', createdAt: '2026-06-01', isDraft: true },
        { id: 'archived', createdAt: '2026-07-01', isArchived: true },
      ],
      total: 4,
    })
    data.set('/moments?pinnedFirst=false&page=1&pageSize=50', {
      items: [{ id: 'moment-1', date: '2026-08-01' }],
      total: 1,
    })
    data.set('/moments/overview', { topics: [{ name: '生活 & 阅读' }] })

    // 来源返回原始 loc，由 sitemap 模块添加运行时 origin 并编码，不能在这里二次编码。
    expect(await handler(event())).toEqual([
      { loc: '/articles/%E4%B8%AD%E6%96%87%20%26%20%E8%B7%AF%E5%BE%84', lastmod: '2026-10-01' },
      { loc: '/articles/2', lastmod: '2026-02-01' },
      { loc: '/flash/note-1', lastmod: '2026-10-02' },
      { loc: '/flash/note-2', lastmod: '2026-05-01' },
      { loc: '/moments/moment-1' },
      { loc: '/moments/topic/生活 & 阅读' },
    ])
    expect(upstream).toHaveBeenCalledTimes(4)
    for (const [url, options] of upstream.mock.calls) {
      expect(url).toMatch(/^https:\/\/api\.example\.test\/api\/v1\//)
      expect(options).toEqual({ method: 'GET', credentials: 'omit', cache: 'no-store', timeout: 10000, retry: 0 })
    }
  })

  it('话题保留中文、空格与 XML 字符，排除无法安全表达的路径和查询分隔符', async () => {
    data.set('/moments/overview', {
      topics: ['摄影', 'a b', 'a&b', '<随笔>', 'a/b', 'a?b', 'a#b', 'a%b'].map((name) => ({ name })),
    })
    expect(await handler(event())).toEqual([
      { loc: '/moments/topic/摄影' },
      { loc: '/moments/topic/a b' },
      { loc: '/moments/topic/a&b' },
      { loc: '/moments/topic/<随笔>' },
    ])
  })

  it('读取后续页时保留原查询参数，直到各领域记录完整', async () => {
    const flashes = Array.from({ length: 101 }, (_, index) => ({ id: `flash-${index}`, createdAt: '2026-10-01' }))
    const moments = Array.from({ length: 51 }, (_, index) => ({ id: `moment-${index}` }))
    data.set('/flashes?page=1&pageSize=100', { items: flashes.slice(0, 100), total: 101 })
    data.set('/flashes?page=2&pageSize=100', { items: flashes.slice(100), total: 101 })
    data.set('/moments?pinnedFirst=false&page=1&pageSize=50', { items: moments.slice(0, 50), total: 51 })
    data.set('/moments?pinnedFirst=false&page=2&pageSize=50', { items: moments.slice(50), total: 51 })

    expect(await handler(event())).toEqual([
      ...flashes.map((note) => ({ loc: `/flash/${note.id}`, lastmod: note.createdAt })),
      ...moments.map((moment) => ({ loc: `/moments/${moment.id}` })),
    ])
    expect(upstream).toHaveBeenCalledTimes(6)
  })

  it.each(['/flashes?page=1&pageSize=100', '/moments?pinnedFirst=false&page=1&pageSize=50', '/moments/overview'])(
    '非核心来源 %s 故障时只移除对应条目',
    async (failedPath) => {
      data.set('/posts/metadata', { archive: [{ id: 1, date: '2026-10-01' }] })
      data.set('/flashes?page=1&pageSize=100', { items: [{ id: 'one', createdAt: '2026-10-02' }], total: 1 })
      data.set('/moments?pinnedFirst=false&page=1&pageSize=50', { items: [{ id: 'two' }], total: 1 })
      data.set('/moments/overview', { topics: [{ name: '阅读' }] })
      failures.add(failedPath)

      expect(await handler(event())).toEqual([
        { loc: '/articles/1', lastmod: '2026-10-01' },
        ...(failedPath.startsWith('/flashes') ? [] : [{ loc: '/flash/one', lastmod: '2026-10-02' }]),
        ...(failedPath.startsWith('/moments?') ? [] : [{ loc: '/moments/two' }]),
        ...(failedPath === '/moments/overview' ? [] : [{ loc: '/moments/topic/阅读' }]),
      ])
    },
  )

  it('非核心来源后续页失败时丢弃该领域残缺结果，仍保留文章', async () => {
    data.set('/posts/metadata', { archive: [{ id: 1, date: '2026-10-01' }] })
    data.set('/flashes?page=1&pageSize=100', {
      items: Array.from({ length: 100 }, (_, id) => ({ id: String(id), createdAt: '2026-10-01' })),
      total: 101,
    })
    failures.add('/flashes?page=2&pageSize=100')
    expect(await handler(event())).toEqual([{ loc: '/articles/1', lastmod: '2026-10-01' }])
    expect(upstream).toHaveBeenCalledTimes(5)
  })

  it('文章元数据失败时返回脱敏的 503，不用空列表掩盖核心来源故障', async () => {
    failures.add('/posts/metadata')
    await expect(handler(event())).rejects.toMatchObject({ statusCode: 503, message: '公开内容暂时无法加载' })
  })

  it('公开 API 未配置时返回 503，且不尝试上游请求', async () => {
    runtimeConfig.apiBaseUrl = ''
    await expect(handler(event())).rejects.toMatchObject({ statusCode: 503, message: '公开内容服务尚未配置' })
    expect(upstream).not.toHaveBeenCalled()
  })

  it('真实空数据返回空来源，不填入演示内容', async () => {
    expect(await handler(event())).toEqual([])
  })
})
