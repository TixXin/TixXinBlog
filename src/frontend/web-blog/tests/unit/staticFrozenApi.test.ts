/** @file staticFrozenApi.test.ts @description 静态发布冻结接口：键规范化、文件映射、取数改写与写入拒绝、自由文本查询回退 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FROZEN_SOURCE_HEADER,
  apiRelativePath,
  frozenAllKey,
  frozenApiFile,
  frozenApiKey,
  hasTextQuery,
} from '../../app/features/static/frozenApi'
import { createStaticFetchGuard, type TextQueryFallback } from '../../app/features/static/staticFetch'
import { filterFrozenList, textQueryFallback } from '../../app/features/static/textQuery'
import { enableStaticImageVariants, managedImageSrcset, managedImageUrl } from '../../app/utils/managedImage'

describe('冻结接口键', () => {
  it('合并地址与选项中的查询，去掉空值后排序，与参数书写顺序无关', () => {
    const a = frozenApiKey('/posts?tag=Vue', { pageSize: 15, page: 2, folder: undefined, search: null })
    const b = frozenApiKey('/posts', { page: '2', tag: 'Vue' }, { pageSize: 15 })
    expect(a).toBe('/posts?page=2&pageSize=15&tag=Vue')
    expect(b).toBe(a)
    expect(frozenApiKey('/links/metadata')).toBe('/links/metadata')
  })

  it('路径分段统一编码，中文标签是否预先编码得到同一键', () => {
    expect(frozenApiKey('/tags/前端')).toBe(frozenApiKey(`/tags/${encodeURIComponent('前端')}`))
    expect(frozenApiKey('/tags/a%2Fb')).toBe('/tags/a%2Fb')
  })

  it('数组参数按重复键展开，布尔与数字转为字符串', () => {
    expect(frozenApiKey('/gallery', { ids: [3, 1], featured: true })).toBe('/gallery?featured=true&ids=1&ids=3')
  })

  it('文件名稳定且只含安全字符，全量键与普通键不同', () => {
    const file = frozenApiFile('/posts?page=2')
    expect(file).toMatch(/^\/_api\/[0-9a-z]+\.json$/)
    expect(frozenApiFile('/posts?page=2')).toBe(file)
    expect(frozenApiFile('/posts?page=3')).not.toBe(file)
    expect(frozenApiFile(frozenAllKey('/posts'))).not.toBe(frozenApiFile('/posts'))
  })

  it('只识别非空的自由文本参数', () => {
    expect(hasTextQuery('/links?q=vue')).toBe(true)
    expect(hasTextQuery('/posts?search=%20')).toBe(false)
    expect(hasTextQuery('/posts?page=1')).toBe(false)
  })

  it('只接受同源接口基址下的地址', () => {
    const origin = 'https://blog.example'
    expect(apiRelativePath('/api/v1/posts?page=2', '/api/v1', origin)).toBe('/posts?page=2')
    expect(apiRelativePath('https://blog.example/api/v1/site', '/api/v1', origin)).toBe('/site')
    expect(apiRelativePath('/api/v10/posts', '/api/v1', origin)).toBeNull()
    expect(apiRelativePath('https://cdn.example/api/v1/posts', '/api/v1', origin)).toBeNull()
    expect(apiRelativePath('/_nuxt/app.js', '/api/v1', origin)).toBeNull()
  })
})

function fakeFetch(respond?: (request: string) => Response) {
  const calls: { request: string; init?: RequestInit }[] = []
  const native = (async (request: RequestInfo | URL, init?: RequestInit) => {
    const url = String(request instanceof Request ? request.url : request)
    calls.push({ request: url, init })
    return respond?.(url) ?? new Response(JSON.stringify({ code: 0, data: null }), { status: 200 })
  }) as typeof fetch
  return { native, calls }
}
const json = (data: unknown) => ({ code: 0, data })

describe('静态取数守卫', () => {
  const setup = (options: { respond?: (request: string) => Response; fallback?: TextQueryFallback } = {}) => {
    const { native, calls } = fakeFetch(options.respond)
    const fallback = options.fallback ?? vi.fn(async () => new Response('{}', { status: 404 }))
    const guard = createStaticFetchGuard(native, {
      apiBase: '/api/v1',
      origin: 'https://blog.example',
      fallback,
    })
    return { guard, calls, fallback }
  }

  it('公开 GET 改读冻结文件，查询串规范化后作为原始键', async () => {
    const { guard, calls } = setup()
    await guard('/api/v1/posts?pageSize=15&page=2')
    expect(calls[0]!.request).toBe(frozenApiFile('/posts?page=2&pageSize=15'))
    expect(new Headers(calls[0]!.init!.headers).get(FROZEN_SOURCE_HEADER)).toBe('/posts?page=2&pageSize=15')
    await guard('https://blog.example/api/v1/links/metadata')
    expect(calls[1]!.request).toBe(frozenApiFile('/links/metadata'))
  })

  it('非接口地址与二进制接口原样请求，写入请求直接拒绝且不发出', async () => {
    const { guard, calls } = setup()
    await guard('/_nuxt/app.js')
    await guard('/api/v1/media/8b7c145a-50b1-4b98-9867-87de592527ab-w640.webp')
    expect(calls.map((call) => call.request)).toEqual([
      '/_nuxt/app.js',
      '/api/v1/media/8b7c145a-50b1-4b98-9867-87de592527ab-w640.webp',
    ])
    await expect(guard('/api/v1/guestbook', { method: 'POST' })).rejects.toMatchObject({ statusCode: 405 })
    expect(calls).toHaveLength(2)
  })

  it('自由文本查询直接交给回退', async () => {
    const fallback = vi.fn(async () => new Response(JSON.stringify(json({ total: 0 })), { status: 200 }))
    const { guard, calls } = setup({ fallback })
    const response = await guard('/api/v1/links?q=vue&page=1')
    expect(fallback.mock.calls[0]![0]).toBe('/links?page=1&q=vue')
    expect(calls).toHaveLength(0)
    expect(await response.json()).toEqual(json({ total: 0 }))
  })

  it('精确文件缺失时在全量上计算，全量也没有时保留原来的 404', async () => {
    const ok = (data: unknown) => new Response(JSON.stringify(json(data)), { status: 200 })
    // 精确文件缺失（404），列表全量存在
    const { guard } = setup({
      respond: (request: string) =>
        request === frozenApiFile('/links#all')
          ? ok({ items: [{ id: 1 }, { id: 2 }] })
          : new Response('', { status: 404 }),
      fallback: textQueryFallback,
    })
    const response = await guard('/api/v1/links?page=2&pageSize=1')
    expect(response.status).toBe(200)
    expect((await response.json()).data).toMatchObject({ items: [{ id: 2 }], total: 2 })
    expect((await guard('/api/v1/gallery?page=3')).status).toBe(404)
  })
})

describe('自由文本查询回退', () => {
  const items = [
    { id: 1, name: 'Vue.js', description: '渐进式框架', isFeatured: true, tags: [{ label: '前端' }] },
    { id: 2, name: 'NestJS', description: '后端框架', isFeatured: false, tags: [{ label: '后端' }] },
    { id: 3, name: 'Vite', description: '构建工具 vue 生态', isFeatured: false, tags: [{ label: '前端' }] },
  ]

  it('不区分大小写匹配公开字段，并按请求分页', () => {
    expect(filterFrozenList('/links?page=1&pageSize=1&q=VUE', items)).toEqual({
      items: [items[0]],
      total: 2,
      page: 1,
      pageSize: 1,
    })
    expect(filterFrozenList('/links?page=2&pageSize=1&q=vue', items).items).toEqual([items[2]])
  })

  it('筛选参数按同名或别名字段比较，未知参数与排序参数不影响结果', () => {
    expect(filterFrozenList('/links?featured=true&q=vue', items).items.map((item) => item.id)).toEqual([1])
    expect(
      filterFrozenList('/posts?search=框架&tag=后端&pinnedFirst=true', items).items.map((item) => item.id),
    ).toEqual([2])
    expect(filterFrozenList('/links?q=框架&unknown=x', items).total).toBe(2)
  })

  it('读取列表全量后返回接口信封；缺少全量数据时给出 404', async () => {
    const load = vi.fn(async () => new Response(JSON.stringify({ code: 0, data: { items } })))
    const response = await textQueryFallback('/flashes/search?q=nest', load)
    expect(await response.json()).toMatchObject({ code: 0, data: { total: 1 } })
    expect(load).toHaveBeenCalledWith(frozenAllKey('/flashes'))
    await expect(
      textQueryFallback(
        '/links?q=x',
        vi.fn(async () => new Response('{}', { status: 404 })),
      ),
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('受管图片变体地址', () => {
  const src = '/api/v1/media/8b7c145a-50b1-4b98-9867-87de592527ab.webp'
  afterEach(() => enableStaticImageVariants(false))

  it('服务器部署使用宽度参数，静态发布改用独立文件名', () => {
    expect(managedImageUrl(src, 640)).toBe(`${src}?w=640`)
    enableStaticImageVariants(true)
    expect(managedImageUrl(src, 640)).toBe('/api/v1/media/8b7c145a-50b1-4b98-9867-87de592527ab-w640.webp')
    expect(managedImageSrcset(src, 700)).toBe(
      '/api/v1/media/8b7c145a-50b1-4b98-9867-87de592527ab-w320.webp 320w, ' +
        '/api/v1/media/8b7c145a-50b1-4b98-9867-87de592527ab-w640.webp 640w, ' +
        `${src} 700w`,
    )
    expect(managedImageUrl('https://cdn.example/a.webp', 640)).toBe('https://cdn.example/a.webp')
  })
})
