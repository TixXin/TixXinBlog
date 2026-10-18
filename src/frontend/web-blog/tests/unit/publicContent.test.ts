// @vitest-environment node
/**
 * @file publicContent.test.ts
 * @description 公开内容工具的匿名读取、XML 与地址安全、条件缓存、分页过滤及受限并发
 */
import { IncomingMessage, ServerResponse } from 'node:http'
import { createRequire } from 'node:module'
import { Socket } from 'node:net'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'

const require = createRequire(import.meta.url)
const h3: typeof import('h3') = createRequire(require.resolve('nuxt/package.json'))('h3')
const runtimeConfig = vi.hoisted(() => ({
  apiBaseUrl: 'https://api.example.test/api/v1/',
  public: { siteUrl: 'https://blog.example.test/' },
}))
const renderMarkdown = vi.hoisted(() => vi.fn<(raw: string, title?: string) => string>())
mockNuxtImport('useRuntimeConfig', () => () => runtimeConfig)
mockNuxtImport(
  '$fetch',
  () =>
    (...args: Parameters<typeof upstream>) =>
      upstream(...args),
)
// Nuxt 的同名页面助手不能代替 Nitro/H3 的响应状态设置。
mockNuxtImport(
  'setResponseStatus',
  () =>
    (...args: Parameters<typeof h3.setResponseStatus>) =>
      h3.setResponseStatus(...args),
)
vi.mock('~/utils/articleMarkdown', () => ({ renderArticleMarkdown: renderMarkdown }))

const upstream = vi.fn<(url: string, options: Record<string, unknown>) => Promise<{ code: number; data: unknown }>>()
let content: typeof import('../../server/utils/publicContent')

function event(headers: Record<string, string> = {}) {
  // 构造真实 H3 事件供响应头校验使用，不监听端口或连接上游。
  const request = new IncomingMessage(new Socket())
  request.method = 'GET'
  request.url = '/rss.xml'
  request.headers = headers
  return h3.createEvent(request, new ServerResponse(request))
}

beforeEach(async () => {
  runtimeConfig.apiBaseUrl = 'https://api.example.test/api/v1/'
  runtimeConfig.public.siteUrl = 'https://blog.example.test/'
  upstream.mockReset()
  renderMarkdown.mockReset()
  vi.stubGlobal('$fetch', upstream)
  vi.stubGlobal('createError', h3.createError)
  vi.stubGlobal('getRequestHeader', h3.getRequestHeader)
  vi.stubGlobal('setResponseHeaders', h3.setResponseHeaders)
  vi.stubGlobal('setResponseStatus', h3.setResponseStatus)
  // Nitro 缓存由框架负责；此处直接执行正文读取，验证本模块的渲染与失败后备。
  vi.stubGlobal('defineCachedFunction', (callback: unknown) => callback)
  content = await import('../../server/utils/publicContent')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('公开 API 读取', () => {
  it('使用服务端地址和匿名 GET，不转发访客 Cookie 或授权头', async () => {
    const data = { title: '书房随笔' }
    upstream.mockResolvedValue({ code: 0, data })
    const request = event({ cookie: 'admin-session=private', authorization: 'Bearer private' })

    await expect(content.publicApi(request, '/site')).resolves.toBe(data)
    expect(upstream).toHaveBeenCalledExactlyOnceWith('https://api.example.test/api/v1/site', {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      timeout: 10000,
      retry: 0,
    })
  })

  it.each(['', '/api/v1', 'ftp://api.example.test', 'undefined'])('未配置 HTTP(S) 上游时返回 503：%s', async (base) => {
    runtimeConfig.apiBaseUrl = base
    await expect(content.publicApi(event(), '/site')).rejects.toMatchObject({
      statusCode: 503,
      message: '公开内容服务尚未配置',
    })
    expect(upstream).not.toHaveBeenCalled()
  })

  it.each(['网络中断', '请求超时', '后端 503'])('上游异常统一转换为脱敏的 503，不返回样本：%s', async (reason) => {
    upstream.mockRejectedValue(new Error(`${reason}：内部敏感信息`))
    await expect(content.publicApi(event(), '/posts')).rejects.toMatchObject({
      statusCode: 503,
      message: '公开内容暂时无法加载',
    })
    expect(upstream).toHaveBeenCalledTimes(1)
  })

  it('HTTP 成功但业务码非零也作为上游失败处理', async () => {
    upstream.mockResolvedValue({ code: 403, data: { title: '不应暴露的内容' } })
    await expect(content.publicApi(event(), '/site')).rejects.toMatchObject({
      statusCode: 503,
      message: '公开内容暂时无法加载',
    })
  })

  it('订阅文章、站点和完整元数据分别使用固定的公开查询', async () => {
    const posts = { items: [{ id: 1 }], total: 1 }
    const site = { title: '山间书房' }
    const metadata = { archive: [{ id: 1 }] }
    upstream
      .mockResolvedValueOnce({ code: 0, data: posts })
      .mockResolvedValueOnce({ code: 0, data: site })
      .mockResolvedValueOnce({ code: 0, data: metadata })

    await expect(content.publicPosts(event())).resolves.toBe(posts)
    await expect(content.publicSiteSettings(event())).resolves.toBe(site)
    await expect(content.publicMetadata(event())).resolves.toBe(metadata)
    expect(upstream.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example.test/api/v1/posts?pageSize=20&pinnedFirst=false',
      'https://api.example.test/api/v1/site',
      'https://api.example.test/api/v1/posts/metadata',
    ])
  })

  it('闪念拒绝草稿和归档，保留公开条目的上游顺序', async () => {
    const published = [{ id: 'first' }, { id: 'second', isDraft: false, isArchived: false }]
    upstream.mockResolvedValue({
      code: 0,
      data: {
        items: [published[0], { id: 'draft', isDraft: true }, { id: 'archived', isArchived: true }, published[1]],
      },
    })
    await expect(content.publicFlashes(event())).resolves.toEqual(published)
    expect(upstream.mock.calls[0]?.[0]).toBe('https://api.example.test/api/v1/flashes?pageSize=30')
  })

  it('朋友圈先排除私有与已删除记录，再截取前 30 条且不改变排序', async () => {
    const published = Array.from({ length: 32 }, (_, index) => ({ id: `published-${index}`, status: 'published' }))
    const items = [
      { id: 'draft', status: 'draft' },
      { id: 'archived', status: 'archived' },
      { id: 'deleted', status: 'published', deletedAt: '2026-10-01' },
      { id: 'legacy' },
      { id: 'not-deleted', status: 'published', deletedAt: null },
      ...published,
    ]
    upstream.mockResolvedValue({ code: 0, data: { items, total: items.length } })
    await expect(content.publicMoments(event())).resolves.toEqual([items[3], items[4], ...published.slice(0, 28)])
    expect(upstream.mock.calls[0]?.[0]).toBe('https://api.example.test/api/v1/moments?pageSize=30&pinnedFirst=false')
  })
})

describe('分页读取', () => {
  it.each(['/flashes', '/moments?pinnedFirst=false'])('保留查询参数并在读满总数时停止：%s', async (path) => {
    upstream
      .mockResolvedValueOnce({ code: 0, data: { items: [1, 2], total: 4 } })
      .mockResolvedValueOnce({ code: 0, data: { items: [3, 4], total: 4 } })
    await expect(content.publicPagedItems(event(), path, 2)).resolves.toEqual([1, 2, 3, 4])
    const separator = path.includes('?') ? '&' : '?'
    expect(upstream.mock.calls.map(([url]) => url)).toEqual([
      `https://api.example.test/api/v1${path}${separator}page=1&pageSize=2`,
      `https://api.example.test/api/v1${path}${separator}page=2&pageSize=2`,
    ])
  })

  it('最后一页不足页大小时停止，即使 total 仍大于已返回数量', async () => {
    upstream
      .mockResolvedValueOnce({ code: 0, data: { items: [1, 2], total: 100 } })
      .mockResolvedValueOnce({ code: 0, data: { items: [3], total: 100 } })
    await expect(content.publicPagedItems(event(), '/flashes', 2)).resolves.toEqual([1, 2, 3])
    expect(upstream).toHaveBeenCalledTimes(2)
  })

  it('空页不继续请求，也不补充样本', async () => {
    upstream.mockResolvedValue({ code: 0, data: { items: [], total: 100 } })
    await expect(content.publicPagedItems(event(), '/flashes', 2)).resolves.toEqual([])
    expect(upstream).toHaveBeenCalledTimes(1)
  })

  it('总数不可信时仍遵守显式页数上限', async () => {
    upstream.mockResolvedValue({ code: 0, data: { items: [1, 2], total: 100 } })
    await expect(content.publicPagedItems(event(), '/flashes', 2, 3)).resolves.toEqual([1, 2, 1, 2, 1, 2])
    expect(upstream).toHaveBeenCalledTimes(3)
  })

  it('后续页失败向调用方抛出 503，不返回先前的残缺列表', async () => {
    upstream
      .mockResolvedValueOnce({ code: 0, data: { items: [1, 2], total: 3 } })
      .mockRejectedValueOnce(new Error('下一页不可用'))
    await expect(content.publicPagedItems(event(), '/flashes', 2)).rejects.toMatchObject({ statusCode: 503 })
    expect(upstream).toHaveBeenCalledTimes(2)
  })
})

describe('XML 与订阅地址', () => {
  it('转义五种 XML 特殊字符，保留中文和补充平面字符', () => {
    expect(content.escapeXml(`中文𠮷 & <标签> "引号" '单引号'`)).toBe(
      '中文𠮷 &amp; &lt;标签&gt; &quot;引号&quot; &apos;单引号&apos;',
    )
  })

  it('移除 XML 1.0 禁用控制字符、孤立代理项和非法码点', () => {
    const forbidden = [0, 1, 8, 11, 12, 14, 31, 0xd800, 0xdbff, 0xdc00, 0xdfff, 0xfffe, 0xffff]
    const input = forbidden.map((point) => `前${String.fromCodePoint(point)}后`).join('|')
    expect(content.escapeXml(input)).toBe(forbidden.map(() => '前后').join('|'))
  })

  it('保留 XML 1.0 合法边界与制表符、换行、回车', () => {
    const input = String.fromCodePoint(9, 10, 13, 0x20, 0xd7ff, 0xe000, 0xfffd, 0x10000, 0x10ffff)
    expect(content.escapeXml(input)).toBe(input)
    expect(content.escapeXml('')).toBe('')
  })

  it('HTML 图片和链接按文章地址解析相对路径，并保持查询参数只转义一次', () => {
    const html =
      '<img src="../images/cover.webp?width=400&amp;quality=80"><a href="?lang=zh&amp;mode=read">阅读</a>' +
      '<a href="#section">段落</a><a href="/archive">归档</a><img src="//cdn.example.test/cover.webp">'
    expect(content.absolutizeHtml(html, 'https://blog.example.test/articles/story')).toBe(
      '<img src="https://blog.example.test/images/cover.webp?width=400&amp;quality=80">' +
        '<a href="https://blog.example.test/articles/story?lang=zh&amp;mode=read">阅读</a>' +
        '<a href="https://blog.example.test/articles/story#section">段落</a>' +
        '<a href="https://blog.example.test/archive">归档</a><img src="https://cdn.example.test/cover.webp">',
    )
  })

  it('HTML 保留非 HTTP(S) 协议、非法地址与非地址属性', () => {
    const html =
      '<a href="mailto:writer@example.test">邮件</a><img src="data:image/png;base64,AAAA">' +
      '<a href="http://[broken">异常</a><p data-src="/image.webp">正文</p>'
    expect(content.absolutizeHtml(html, 'https://blog.example.test/article')).toBe(html)
    expect(content.absolutizeHtml('<img src="/image.webp">', 'invalid-base')).toBe('<img src="/image.webp">')
  })

  it('HTML srcset 的相对与根相对候选地址绝对化，保留宽度描述符和已有绝对地址', () => {
    const html =
      '<img srcset="../cover.webp?width=400&amp;quality=80 400w, /cover.webp 800w, https://cdn.example.test/cover.webp 1200w">'
    expect(content.absolutizeHtml(html, 'https://blog.example.test/articles/story')).toBe(
      '<img srcset="https://blog.example.test/cover.webp?width=400&amp;quality=80 400w, ' +
        'https://blog.example.test/cover.webp 800w, https://cdn.example.test/cover.webp 1200w">',
    )
  })

  it('HTML srcset 保留 data URI 内的逗号，并解析同组中的密度候选', () => {
    const html = '<img srcset="data:image/png;base64,AAAA 1x, images/cover.webp 2x">'
    expect(content.absolutizeHtml(html, 'https://blog.example.test/articles/story')).toBe(
      '<img srcset="data:image/png;base64,AAAA 1x, https://blog.example.test/articles/images/cover.webp 2x">',
    )
  })

  it('HTML srcset 保留空白和无描述符候选的分隔，不改动 data-srcset', () => {
    const html = '<img srcset=" /small.webp, /large.webp 2x,\t/huge.webp 3x " data-srcset="/placeholder.webp">'
    expect(content.absolutizeHtml(html, 'https://blog.example.test/articles/story')).toBe(
      '<img srcset=" https://blog.example.test/small.webp, https://blog.example.test/large.webp 2x,\t' +
        'https://blog.example.test/huge.webp 3x " data-srcset="/placeholder.webp">',
    )
    expect(content.absolutizeHtml('<img srcset="  ,  ">', 'https://blog.example.test')).toBe('<img srcset="  ,  ">')
  })

  it.each([
    ['/images/cover.webp', 'https://blog.example.test/images/cover.webp'],
    ['images/cover.webp?size=640&quality=80', 'https://blog.example.test/base/images/cover.webp?size=640&quality=80'],
    ['//cdn.example.test/cover.webp', 'https://cdn.example.test/cover.webp'],
    ['http://cdn.example.test/cover.webp', 'http://cdn.example.test/cover.webp'],
  ])('公开媒体地址解析为绝对 HTTP(S) 地址：%s', (input, expected) => {
    expect(content.publicFeedUrl(input, 'https://blog.example.test/base')).toBe(expected)
  })

  it.each([undefined, '', 'javascript:alert(1)', 'data:text/plain,hello', 'ftp://files.example.test/a', 'http://[bad'])(
    '拒绝空值、危险协议与无效公开媒体地址：%s',
    (input) => {
      expect(content.publicFeedUrl(input, 'https://blog.example.test')).toBeUndefined()
    },
  )

  it.each(['https://user@example.test/a', 'https://user:secret@example.test/a', 'https://:secret@example.test/a'])(
    '拒绝携带凭据的公开媒体地址：%s',
    (input) => {
      expect(content.publicFeedUrl(input, 'https://blog.example.test')).toBeUndefined()
    },
  )

  it('站点地址取自当前请求运行配置，并去除末尾斜线', () => {
    expect(content.publicSiteUrl(event())).toBe('https://blog.example.test')
    runtimeConfig.public.siteUrl = 'https://another.example.test/blog/'
    expect(content.publicSiteUrl(event())).toBe('https://another.example.test/blog')
  })
})

describe('文章订阅正文', () => {
  it('编码文章编号，渲染原文并把链接改成文章绝对地址', async () => {
    upstream.mockResolvedValue({ code: 0, data: { title: '林间日记', contentRaw: '[归档](../archive)' } })
    renderMarkdown.mockReturnValue('<a href="../archive">归档</a>')

    await expect(
      content.publicArticleFeedHtml(event(), '中文/编号', 'https://blog.example.test/articles/story'),
    ).resolves.toBe('<a href="https://blog.example.test/archive">归档</a>')
    expect(upstream.mock.calls[0]?.[0]).toBe(
      'https://api.example.test/api/v1/posts/%E4%B8%AD%E6%96%87%2F%E7%BC%96%E5%8F%B7',
    )
    expect(renderMarkdown).toHaveBeenCalledExactlyOnceWith('[归档](../archive)', '林间日记')
  })

  it('没有原文时返回空串供调用方采用摘要，不渲染不存在的正文', async () => {
    upstream.mockResolvedValue({ code: 0, data: { title: '旧日札记' } })
    await expect(content.publicArticleFeedHtml(event(), '1', 'https://blog.example.test/articles/1')).resolves.toBe('')
    expect(renderMarkdown).not.toHaveBeenCalled()
  })

  it('正文读取或渲染失败时返回摘要后备标记', async () => {
    upstream.mockRejectedValueOnce(new Error('正文上游不可用'))
    await expect(content.publicArticleFeedHtml(event(), '1', 'https://blog.example.test/articles/1')).resolves.toBe('')
    upstream.mockResolvedValueOnce({ code: 0, data: { title: '札记', contentRaw: '正文' } })
    renderMarkdown.mockImplementationOnce(() => {
      throw new Error('渲染失败')
    })
    await expect(content.publicArticleFeedHtml(event(), '2', 'https://blog.example.test/articles/2')).resolves.toBe('')
  })
})

describe('订阅条件缓存', () => {
  const body = '<rss><channel><title>山间书房</title></channel></rss>'
  const modified = new Date('2026-10-18T01:02:03.900Z')

  function etag() {
    const request = event()
    content.sendFeed(request, body, modified)
    return String(request.node.res.getHeader('etag'))
  }

  it('成功响应设置 RSS 类型、五分钟缓存、稳定 ETag 与更新时间', () => {
    const first = event()
    expect(content.sendFeed(first, body, modified)).toBe(body)
    expect(first.node.res.statusCode).toBe(200)
    expect(first.node.res.getHeaders()).toMatchObject({
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=300',
      etag: expect.stringMatching(/^W\/"[\w-]{27}"$/),
      'last-modified': 'Sun, 18 Oct 2026 01:02:03 GMT',
    })
    expect(etag()).toBe(first.node.res.getHeader('etag'))
    const changed = event()
    content.sendFeed(changed, body.replace('书房', '日记'), modified)
    expect(changed.node.res.getHeader('etag')).not.toBe(first.node.res.getHeader('etag'))
  })

  it.each(['弱标签', '强标签', '列表中的匹配项', '通配符'])(
    'If-None-Match 匹配返回无正文 304 并保留验证头：%s',
    (mode) => {
      const tag = etag()
      const values = {
        弱标签: tag,
        强标签: tag.replace(/^W\//, ''),
        列表中的匹配项: `"other",  ${tag}  `,
        通配符: '*',
      }
      const request = event({ 'if-none-match': values[mode as keyof typeof values] })
      expect(content.sendFeed(request, body, modified)).toBe('')
      expect(request.node.res.statusCode).toBe(304)
      expect(request.node.res.getHeader('etag')).toBe(tag)
      expect(request.node.res.getHeader('last-modified')).toBe(modified.toUTCString())
      expect(request.node.res.getHeader('cache-control')).toBe('public, max-age=300')
    },
  )

  it('If-None-Match 不匹配时优先返回正文，即使 If-Modified-Since 表示未修改', () => {
    const request = event({ 'if-none-match': '"old-body"', 'if-modified-since': 'Mon, 19 Oct 2026 00:00:00 GMT' })
    expect(content.sendFeed(request, body, modified)).toBe(body)
    expect(request.node.res.statusCode).toBe(200)
  })

  it('If-None-Match 匹配时不受更早的 If-Modified-Since 干扰', () => {
    const request = event({ 'if-none-match': etag(), 'if-modified-since': 'Sat, 17 Oct 2026 00:00:00 GMT' })
    expect(content.sendFeed(request, body, modified)).toBe('')
    expect(request.node.res.statusCode).toBe(304)
  })

  it.each([
    ['Sun, 18 Oct 2026 01:02:03 GMT', 304],
    ['Mon, 19 Oct 2026 00:00:00 GMT', 304],
    ['Sun, 18 Oct 2026 01:02:02 GMT', 200],
    ['invalid-date', 200],
  ])('缺少 ETag 条件时按秒比较 If-Modified-Since：%s', (since, status) => {
    const request = event({ 'if-modified-since': since })
    expect(content.sendFeed(request, body, modified)).toBe(status === 304 ? '' : body)
    expect(request.node.res.statusCode).toBe(status)
  })

  it('最新时间忽略非法或空值，没有有效时间时使用稳定纪元', () => {
    expect(
      content.latestDate(['2026-10-16T08:00:00Z', undefined, 'invalid', null, '2026-10-17T01:00:00+08:00']),
    ).toEqual(new Date('2026-10-16T17:00:00Z'))
    expect(content.latestDate([undefined, null, '', 'invalid'])).toEqual(new Date(0))
    expect(content.latestDate([])).toEqual(new Date(0))
  })
})

describe('受限并发映射', () => {
  it('最多启动指定数量的任务，完成顺序改变时结果仍按输入排列', async () => {
    const gates = Array.from({ length: 4 }, () => Promise.withResolvers<string>())
    const starts = Array.from({ length: 4 }, () => Promise.withResolvers<undefined>())
    const started: number[] = []
    let active = 0
    let peak = 0
    const task = vi.fn(async (index: number) => {
      started.push(index)
      active += 1
      peak = Math.max(peak, active)
      starts[index]!.resolve(undefined)
      try {
        return await gates[index]!.promise
      } finally {
        active -= 1
      }
    })
    const result = content.mapLimit([0, 1, 2, 3], 2, task)
    expect(started).toEqual([0, 1])
    gates[1]!.resolve('第二条')
    await starts[2]!.promise
    expect(started).toEqual([0, 1, 2])
    gates[2]!.resolve('第三条')
    await starts[3]!.promise
    expect(started).toEqual([0, 1, 2, 3])
    gates[3]!.resolve('第四条')
    gates[0]!.resolve('第一条')
    await expect(result).resolves.toEqual(['第一条', '第二条', '第三条', '第四条'])
    expect(peak).toBe(2)
    expect(active).toBe(0)
    expect(task).toHaveBeenCalledTimes(4)
  })

  it('空输入不执行任务，并发上限超过条数时每条也只执行一次', async () => {
    const task = vi.fn(async (value: number) => value * 2)
    await expect(content.mapLimit([], 3, task)).resolves.toEqual([])
    expect(task).not.toHaveBeenCalled()
    await expect(content.mapLimit([1, 2], 10, task)).resolves.toEqual([2, 4])
    expect(task.mock.calls).toEqual([[1], [2]])
  })

  it('任务失败会拒绝整体结果，不把缺失项当成成功', async () => {
    const failure = new Error('正文读取失败')
    const task = vi.fn(async (value: number) => {
      if (value === 2) throw failure
      return value
    })
    await expect(content.mapLimit([1, 2, 3], 1, task)).rejects.toBe(failure)
    expect(task.mock.calls).toEqual([[1], [2]])
  })
})
