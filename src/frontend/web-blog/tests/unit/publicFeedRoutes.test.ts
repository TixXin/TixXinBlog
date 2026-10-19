// @vitest-environment node
/**
 * @file publicFeedRoutes.test.ts
 * @description 三种 RSS 路由的 XML、公开链接、安全正文和条件缓存契约，上游请求全部在内存中替换
 */
import { IncomingMessage, ServerResponse } from 'node:http'
import { createRequire } from 'node:module'
import { Socket } from 'node:net'
import { Window } from 'happy-dom'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'

const require = createRequire(import.meta.url)
const h3: typeof import('h3') = createRequire(require.resolve('nuxt/package.json'))('h3')
const runtimeConfig = vi.hoisted(() => ({
  apiBaseUrl: 'https://api.example.test/api/v1/',
  public: { siteUrl: 'https://blog.example.test/' } as { siteUrl: string; i18n?: { defaultLocale?: string } },
}))
mockNuxtImport('useRuntimeConfig', () => () => runtimeConfig)
mockNuxtImport(
  '$fetch',
  () =>
    (...args: Parameters<typeof upstream>) =>
      upstream(...args),
)
// 测试转换会引入 Nuxt 页面同名助手，显式使用真实 H3 实现验证服务端状态码。
mockNuxtImport(
  'setResponseStatus',
  () =>
    (...args: Parameters<typeof h3.setResponseStatus>) =>
      h3.setResponseStatus(...args),
)

const domWindow = new Window()
const DOMParser = domWindow.DOMParser
afterAll(() => domWindow.happyDOM.close())

const data = new Map<string, unknown>()
const failures = new Set<string>()
const responseCodes = new Map<string, number>()
const upstream = vi.fn<(url: string, options: Record<string, unknown>) => Promise<{ code: number; data: unknown }>>(
  async (url) => {
    const path = url.replace(runtimeConfig.apiBaseUrl.replace(/\/$/, ''), '')
    if (failures.has(path)) throw new Error('上游内部错误与私人连接信息')
    if (!data.has(path)) throw new Error(`未声明的上游请求：${path}`)
    return { code: responseCodes.get(path) ?? 0, data: data.get(path) }
  },
)
let handlers: Record<string, typeof import('../../server/routes/rss.xml').default>
const routes = [
  { route: 'rss.xml', source: '/posts?pageSize=20&pinnedFirst=false', channel: '/' },
  { route: 'flash.xml', source: '/flashes?pageSize=30', channel: '/flash' },
  { route: 'moments.xml', source: '/moments?pageSize=30&pinnedFirst=false', channel: '/moments' },
]
const site = {
  name: '山海手记',
  description: '记录真实的日常',
  ownerName: '林舟',
  updatedAt: '2026-10-01T12:00:00.000Z',
}

function event(route: string, method = 'GET', headers: Record<string, string> = {}) {
  // H3 直接处理内存事件，不启动 HTTP 服务，也不连接真实上游。
  const request = new IncomingMessage(new Socket())
  request.url = `/${route}`
  request.method = method
  request.headers = {
    host: 'forged.example.test',
    cookie: 'admin-session=private',
    authorization: 'Bearer private',
    'x-forwarded-host': 'forged.example.test',
    ...headers,
  }
  return h3.createEvent(request, new ServerResponse(request))
}

function parse(xml: string) {
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  expect(document.querySelector('parsererror')).toBeNull()
  expect(document.documentElement.tagName).toBe('rss')
  return document
}

function post(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    title: '雨后的山路',
    summary: '山间步行见闻',
    folder: '随笔',
    date: '2026-10-02T08:30:00.000Z',
    tags: [],
    ...overrides,
  }
}

function flash(overrides: Record<string, unknown> = {}) {
  return {
    id: 'note-1',
    content: '今天看到一片很特别的云',
    tags: [],
    createdAt: '2026-10-02T08:30:00.000Z',
    updatedAt: '2026-10-03T08:30:00.000Z',
    ...overrides,
  }
}

function moment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'moment-1',
    content: '海边散步',
    date: '2026-10-02T08:30:00.000Z',
    ...overrides,
  }
}

beforeEach(async () => {
  runtimeConfig.apiBaseUrl = 'https://api.example.test/api/v1/'
  runtimeConfig.public.siteUrl = 'https://blog.example.test/'
  data.clear()
  failures.clear()
  responseCodes.clear()
  upstream.mockClear()
  data.set('/site', { ...site })
  for (const { source } of routes) data.set(source, { items: [], total: 0 })
  for (const [name, implementation] of Object.entries(h3)) vi.stubGlobal(name, implementation)
  // 保留真实文章读取与渲染，只移除 Nitro 存储缓存对单测之间的影响。
  vi.stubGlobal('defineCachedFunction', (callback: unknown) => callback)
  vi.stubGlobal('$fetch', upstream)
  handlers = {
    'rss.xml': (await import('../../server/routes/rss.xml')).default,
    'flash.xml': (await import('../../server/routes/flash.xml')).default,
    'moments.xml': (await import('../../server/routes/moments.xml')).default,
  }
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe.each(routes)('$route 公开订阅与缓存', ({ route, source, channel }) => {
  it('使用运行时站点地址和匿名上游请求，真实空列表不补演示数据', async () => {
    const request = event(route)
    const body = await handlers[route]!(request)
    const document = parse(body)
    expect(document.querySelector('channel > link')?.textContent).toBe(`https://blog.example.test${channel}`)
    expect(document.getElementsByTagName('atom:link')[0]?.getAttribute('href')).toBe(
      `https://blog.example.test/${route}`,
    )
    expect(document.querySelectorAll('item')).toHaveLength(0)
    expect(body).not.toContain('forged.example.test')
    expect(request.node.res.statusCode).toBe(200)
    expect(request.node.res.getHeader('content-type')).toBe('application/rss+xml; charset=utf-8')
    expect(request.node.res.getHeader('cache-control')).toBe('public, max-age=300')
    expect(request.node.res.getHeader('last-modified')).toBe('Thu, 01 Oct 2026 12:00:00 GMT')
    expect(request.node.res.getHeader('etag')).toMatch(/^W\/"[\w-]+"$/)
    expect(upstream.mock.calls.map(([url]) => url)).toEqual(
      expect.arrayContaining([`https://api.example.test/api/v1${source}`, 'https://api.example.test/api/v1/site']),
    )
    expect(upstream).toHaveBeenCalledTimes(2)
    for (const [, options] of upstream.mock.calls) {
      expect(options).toEqual({ method: 'GET', credentials: 'omit', cache: 'no-store', timeout: 10000, retry: 0 })
    }
  })

  it('HEAD 通过方法校验并生成与 GET 相同的缓存元数据', async () => {
    const get = event(route)
    await handlers[route]!(get)
    const head = event(route, 'HEAD')
    await expect(handlers[route]!(head)).resolves.toEqual(expect.any(String))
    expect(head.node.res.getHeaders()).toEqual(get.node.res.getHeaders())
  })

  it.each(['POST', 'PUT', 'DELETE'])('%s 返回 405，保持 no-store 且不读取上游', async (method) => {
    const request = event(route, method)
    await expect(handlers[route]!(request)).rejects.toMatchObject({ statusCode: 405 })
    expect(request.node.res.getHeader('cache-control')).toBe('no-store')
    expect(upstream).not.toHaveBeenCalled()
  })

  it('内容不变时 ETag 稳定，兼容强弱标签列表并返回无正文 304', async () => {
    const first = event(route)
    const originalBody = await handlers[route]!(first)
    const etag = String(first.node.res.getHeader('etag'))
    const second = event(route)
    expect(await handlers[route]!(second)).toBe(originalBody)
    expect(second.node.res.getHeader('etag')).toBe(etag)
    const conditional = event(route, 'GET', { 'if-none-match': `"other", ${etag.replace(/^W\//, '')}` })
    expect(await handlers[route]!(conditional)).toBe('')
    expect(conditional.node.res.statusCode).toBe(304)
    expect(conditional.node.res.getHeaders()).toEqual(first.node.res.getHeaders())
    // 即使客户端命中缓存，也重新读取公开来源，及时反映撤回与故障。
    expect(upstream).toHaveBeenCalledTimes(6)
  })

  it('日期条件可返回 304，但不匹配的 ETag 优先于日期，内容变更会生成新标签', async () => {
    const initial = event(route)
    await handlers[route]!(initial)
    const etag = String(initial.node.res.getHeader('etag'))
    const modified = String(initial.node.res.getHeader('last-modified'))
    const dated = event(route, 'GET', { 'if-modified-since': modified })
    expect(await handlers[route]!(dated)).toBe('')
    expect(dated.node.res.statusCode).toBe(304)
    const mismatch = event(route, 'GET', { 'if-none-match': '"different"', 'if-modified-since': modified })
    expect(await handlers[route]!(mismatch)).toContain('<rss ')
    expect(mismatch.node.res.statusCode).toBe(200)
    data.set('/site', { ...site, name: '更新后的山海手记' })
    const changed = event(route, 'GET', { 'if-none-match': etag })
    expect(await handlers[route]!(changed)).toContain('更新后的山海手记')
    expect(changed.node.res.statusCode).toBe(200)
    expect(changed.node.res.getHeader('etag')).not.toBe(etag)
  })

  it.each(['source', 'site'])('%s 网络失败返回脱敏 503，不能被旧 ETag 转成 304', async (failedSource) => {
    const initial = event(route)
    await handlers[route]!(initial)
    failures.add(failedSource === 'source' ? source : '/site')
    const request = event(route, 'GET', { 'if-none-match': String(initial.node.res.getHeader('etag')) })
    await expect(handlers[route]!(request)).rejects.toMatchObject({
      statusCode: 503,
      message: '公开内容暂时无法加载',
    })
    expect(request.node.res.getHeader('cache-control')).toBe('no-store')
    expect(request.node.res.getHeader('etag')).toBeUndefined()
    expect(request.node.res.getHeader('last-modified')).toBeUndefined()
  })

  it('上游业务失败同样返回 503，不用空列表掩盖错误', async () => {
    responseCodes.set(source, 50001)
    const request = event(route)
    await expect(handlers[route]!(request)).rejects.toMatchObject({
      statusCode: 503,
      message: '公开内容暂时无法加载',
    })
    expect(request.node.res.getHeader('cache-control')).toBe('no-store')
  })
})

describe('文章 RSS 的正文与 XML', () => {
  it('真实 Markdown 受管图片的原图和全部 srcset 候选都使用运行时绝对地址', async () => {
    const path = '/api/v1/media/3ba4de2b-a168-4fd4-ab7f-21d5fb614db4.webp'
    data.set('/posts?pageSize=20&pinnedFirst=false', { items: [post()] })
    data.set('/posts/7', { title: '山间骑行', contentRaw: `![骑行](${path})` })

    const document = parse(await handlers['rss.xml']!(event('rss.xml')))
    const encoded = document.getElementsByTagName('content:encoded')[0]!
    const image = new DOMParser().parseFromString(encoded.textContent, 'text/html').querySelector('img')!
    expect(image.getAttribute('src')).toBe(`https://blog.example.test${path}`)
    expect(image.getAttribute('srcset')).toBe(
      [320, 640, 960, 1280].map((width) => `https://blog.example.test${path}?w=${width} ${width}w`).join(', '),
    )
    expect(image.getAttribute('sizes')).toBe('(max-width: 768px) 100vw, 800px')
  })

  it('转义元数据与全文，保留稳定 ID 并将相对媒体和链接解析为绝对地址', async () => {
    const title = '山路 & <风景> "远方" \'随笔\' ]]> 🌊'
    const summary = '<script>alert("summary")</script> & 摘要 ]]>'
    data.set('/site', { ...site, name: '山海 & <日记>', description: '一路 <向前>', ownerName: '林 & "舟"' })
    data.set('/posts?pageSize=20&pinnedFirst=false', {
      items: [post({ title, summary, slug: '山路 & 风景', folder: '<随笔>', tags: [{ label: '自然 & 生活' }] })],
    })
    data.set('/posts/7', {
      title,
      contentRaw:
        '[继续阅读](../next?from=rss&view=full)\n\n![山路](/photos/trail.jpg?size=large&fit=cover)\n\n<script>alert("body")</script> ]]>',
    })
    const request = event('rss.xml')
    const body = await handlers['rss.xml']!(request)
    const document = parse(body)
    const item = document.querySelector('item')!
    expect(document.querySelector('channel > title')?.textContent).toBe('山海 & <日记>')
    expect(document.querySelector('channel > description')?.textContent).toBe('一路 <向前>')
    expect(item.querySelector('title')?.textContent).toBe(title)
    expect(item.querySelector('description')?.children).toHaveLength(0)
    // RSS 阅读器先解 XML，再按 HTML 展示摘要；两层解析后仍须是原文。
    const summaryHtml = new DOMParser().parseFromString(item.querySelector('description')!.textContent, 'text/html')
    expect(summaryHtml.querySelector('script')).toBeNull()
    expect(summaryHtml.body.textContent).toBe(summary)
    expect(item.querySelector('link')?.textContent).toBe(
      'https://blog.example.test/articles/%E5%B1%B1%E8%B7%AF%20%26%20%E9%A3%8E%E6%99%AF',
    )
    expect(item.querySelector('guid')?.textContent).toBe('https://blog.example.test/articles/7')
    expect(item.getElementsByTagName('dc:creator')[0]?.textContent).toBe('林 & "舟"')
    expect([...item.querySelectorAll('category')].map((category) => category.textContent)).toEqual([
      '<随笔>',
      '自然 & 生活',
    ])
    expect(body).not.toContain('<![CDATA[')
    expect(body).not.toContain('<script>')
    expect(body).toContain('&apos;随笔&apos;')
    expect(body).toContain(']]&gt;')
    const encoded = item.getElementsByTagName('content:encoded')[0]!
    expect(encoded.children).toHaveLength(0)
    const html = new DOMParser().parseFromString(encoded.textContent, 'text/html')
    expect(html.querySelector('a')?.getAttribute('href')).toBe('https://blog.example.test/next?from=rss&view=full')
    expect(html.querySelector('img')?.getAttribute('src')).toBe(
      'https://blog.example.test/photos/trail.jpg?size=large&fit=cover',
    )
    expect(html.querySelector('script')).toBeNull()
    expect(html.body.textContent).toContain('<script>alert("body")</script> ]]>')
    expect(request.node.res.getHeader('last-modified')).toBe('Fri, 02 Oct 2026 08:30:00 GMT')
  })

  it('正文单项失败时保留摘要与其他文章全文，不使整份订阅失败', async () => {
    data.set('/posts?pageSize=20&pinnedFirst=false', {
      items: [post({ id: 7 }), post({ id: 8, title: '月光', summary: '夜间步行' })],
    })
    failures.add('/posts/7')
    data.set('/posts/8', { title: '月光', contentRaw: '沿河慢慢走' })
    const request = event('rss.xml')
    const document = parse(await handlers['rss.xml']!(request))
    const items = document.querySelectorAll('item')
    expect(items).toHaveLength(2)
    expect(items[0]!.querySelector('description')?.textContent).toBe('山间步行见闻')
    expect(items[0]!.getElementsByTagName('content:encoded')).toHaveLength(0)
    expect(items[1]!.getElementsByTagName('content:encoded')[0]?.textContent).toContain('沿河慢慢走')
    expect(request.node.res.getHeader('cache-control')).toBe('public, max-age=300')
  })
})

describe('闪念 RSS 的公开过滤与标题', () => {
  it('过滤草稿和归档，转义正文与标签，编码编号并使用更新时间', async () => {
    const content = '<img src="x" onerror="alert(1)"> & 灵感 ]]>\n第二行'
    data.set('/flashes?pageSize=30', {
      items: [
        flash({ id: '随记 / 1', content, tags: ['<灵感>', 'A & B'] }),
        flash({ id: 'draft', content: '未公开草稿', isDraft: true }),
        flash({ id: 'archived', content: '已归档内容', isArchived: true }),
      ],
    })
    data.set('/site', { ...site, ownerName: '' })
    const request = event('flash.xml')
    const body = await handlers['flash.xml']!(request)
    const document = parse(body)
    expect(document.querySelectorAll('item')).toHaveLength(1)
    const item = document.querySelector('item')!
    expect(item.querySelector('title')?.textContent).toBe(content.replace(/\s+/g, ' '))
    expect(item.querySelector('description')?.children).toHaveLength(0)
    const descriptionHtml = new DOMParser().parseFromString(item.querySelector('description')!.textContent, 'text/html')
    expect(descriptionHtml.querySelector('img')).toBeNull()
    expect(descriptionHtml.body.textContent).toBe(content)
    expect(item.querySelector('link')?.textContent).toBe('https://blog.example.test/flash/%E9%9A%8F%E8%AE%B0%20%2F%201')
    expect(item.querySelector('guid')?.textContent).toBe(item.querySelector('link')?.textContent)
    expect(item.querySelector('guid')?.getAttribute('isPermaLink')).toBe('true')
    expect(item.getElementsByTagName('dc:creator')[0]?.textContent).toBe(site.name)
    expect([...item.querySelectorAll('category')].map((category) => category.textContent)).toEqual(['<灵感>', 'A & B'])
    expect(body).not.toContain('<img')
    expect(body).not.toContain('未公开草稿')
    expect(body).not.toContain('已归档内容')
    expect(request.node.res.getHeader('last-modified')).toBe('Sat, 03 Oct 2026 08:30:00 GMT')
  })

  it('按 Unicode 字符截断 60 字标题，清理 XML 禁止字符并保留完整正文', async () => {
    const content = `${'🌊'.repeat(60)}海风\u0000\ud800`
    data.set('/flashes?pageSize=30', { items: [flash({ content })] })
    const body = await handlers['flash.xml']!(event('flash.xml'))
    const item = parse(body).querySelector('item')!
    expect(item.querySelector('title')?.textContent).toBe(`${'🌊'.repeat(60)}…`)
    expect(item.querySelector('description')?.textContent).toBe(`${'🌊'.repeat(60)}海风`)
    expect(body).not.toContain('\u0000')
    expect(body).not.toContain('\ud800')
  })
})

describe('朋友圈 RSS 的媒体与安全正文', () => {
  it('仅输出公开动态，正文保留换行且防止 HTML 注入，首图生成绝对 enclosure', async () => {
    const content = '<script>alert("x")</script> & 海风 ]]>\n第二行'
    data.set('/moments?pageSize=30&pinnedFirst=false', {
      items: [
        moment({
          id: '海边 / 1',
          content,
          images: ['/photos/coast.JPG?size=large&fit=cover', '/photos/second.png'],
          topics: ['海 & 风', '<旅行>'],
          comments: [{ content: '私人评论' }],
          userId: 'private-owner-id',
          status: 'published',
        }),
        moment({ id: 'draft', content: '草稿动态', status: 'draft' }),
        moment({ id: 'archived', content: '归档动态', status: 'archived' }),
        moment({ id: 'deleted', content: '已删除动态', deletedAt: '2026-10-01' }),
      ],
    })
    const body = await handlers['moments.xml']!(event('moments.xml'))
    const document = parse(body)
    expect(document.querySelectorAll('item')).toHaveLength(1)
    const item = document.querySelector('item')!
    const description = item.querySelector('description')!
    expect(description.children).toHaveLength(0)
    const html = new DOMParser().parseFromString(description.textContent, 'text/html')
    expect(html.querySelector('script')).toBeNull()
    expect(html.body.textContent).toBe(content.replace('\n', ''))
    expect(html.querySelectorAll('br')).toHaveLength(1)
    expect(html.querySelectorAll('img')).toHaveLength(1)
    expect(html.querySelector('img')?.getAttribute('src')).toBe(
      'https://blog.example.test/photos/coast.JPG?size=large&fit=cover',
    )
    expect(item.querySelector('enclosure')?.getAttribute('url')).toBe(
      'https://blog.example.test/photos/coast.JPG?size=large&fit=cover',
    )
    expect(item.querySelector('enclosure')?.getAttribute('type')).toBe('image/jpeg')
    expect(item.querySelector('enclosure')?.getAttribute('length')).toBe('0')
    expect(item.querySelector('link')?.textContent).toBe(
      'https://blog.example.test/moments/%E6%B5%B7%E8%BE%B9%20%2F%201',
    )
    expect([...item.querySelectorAll('category')].map((category) => category.textContent)).toEqual([
      '海 & 风',
      '<旅行>',
    ])
    for (const privateValue of ['草稿动态', '归档动态', '已删除动态', '私人评论', 'private-owner-id']) {
      expect(body).not.toContain(privateValue)
    }
    expect(body).not.toContain('<![CDATA[')
  })

  it.each(['javascript:alert(1)', 'data:image/png;base64,AA==', 'https://user:secret@cdn.example.test/a.png'])(
    '拒绝危险或含凭据媒体地址 %s',
    async (image) => {
      data.set('/moments?pageSize=30&pinnedFirst=false', { items: [moment({ images: [image] })] })
      const body = await handlers['moments.xml']!(event('moments.xml'))
      const document = parse(body)
      expect(document.querySelector('enclosure')).toBeNull()
      expect(document.querySelector('item > description')?.textContent).toBe('海边散步')
      expect(body).not.toContain(image)
    },
  )

  it('未知扩展名仍可展示安全图片，但不臆造 enclosure MIME 类型', async () => {
    data.set('/moments?pageSize=30&pinnedFirst=false', {
      items: [moment({ images: ['//cdn.example.test/image?width=640&height=480'] })],
    })
    const document = parse(await handlers['moments.xml']!(event('moments.xml')))
    expect(document.querySelector('enclosure')).toBeNull()
    const description = document.querySelector('item > description')!.textContent
    const html = new DOMParser().parseFromString(description, 'text/html')
    expect(html.querySelector('img')?.getAttribute('src')).toBe('https://cdn.example.test/image?width=640&height=480')
  })
})

describe('闪念与朋友圈 RSS 的频道语言跟随站点默认语言', () => {
  afterEach(() => {
    delete runtimeConfig.public.i18n
  })

  it('未配置时为中文频道', async () => {
    const flash = parse(await handlers['flash.xml']!(event('flash.xml')))
    expect(flash.querySelector('channel > language')?.textContent).toBe('zh-CN')
    expect(flash.querySelector('channel > title')?.textContent).toBe('山海手记 闪念')
    expect(flash.querySelector('channel > description')?.textContent).toBe('公开的灵感碎片')
    const moments = parse(await handlers['moments.xml']!(event('moments.xml')))
    expect(moments.querySelector('channel > language')?.textContent).toBe('zh-CN')
    expect(moments.querySelector('channel > title')?.textContent).toBe('山海手记 朋友圈')
  })

  it('站点默认英文时频道标题与说明为英文，条目内容与站点资料不翻译', async () => {
    runtimeConfig.public.i18n = { defaultLocale: 'en' }
    data.set('/flashes?pageSize=30', { items: [flash({ content: '海风里的灵感' })] })
    const flashFeed = parse(await handlers['flash.xml']!(event('flash.xml')))
    expect(flashFeed.querySelector('channel > language')?.textContent).toBe('en')
    expect(flashFeed.querySelector('channel > title')?.textContent).toBe('山海手记 Flash notes')
    expect(flashFeed.querySelector('channel > description')?.textContent).toBe('Public fragments of ideas')
    expect(flashFeed.querySelector('item > title')?.textContent).toBe('海风里的灵感')
    const moments = parse(await handlers['moments.xml']!(event('moments.xml')))
    expect(moments.querySelector('channel > language')?.textContent).toBe('en')
    expect(moments.querySelector('channel > title')?.textContent).toBe('山海手记 Moments')
    expect(moments.querySelector('channel > description')?.textContent).toBe('记录真实的日常')
  })

  it('无效的默认语言回退中文', async () => {
    runtimeConfig.public.i18n = { defaultLocale: 'fr' }
    const flash = parse(await handlers['flash.xml']!(event('flash.xml')))
    expect(flash.querySelector('channel > language')?.textContent).toBe('zh-CN')
  })
})
