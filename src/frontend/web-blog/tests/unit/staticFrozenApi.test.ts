/** @file staticFrozenApi.test.ts @description 静态发布冻结接口：键规范化、文件映射、取数改写与写入拒绝、自由文本查询回退 */
import { describe, expect, it, vi } from 'vitest'
import {
  FROZEN_SOURCE_HEADER,
  apiRelativePath,
  frozenAllKey,
  frozenApiFile,
  frozenApiKey,
  hasTextQuery,
} from '../../app/features/static/frozenApi'
import { createStaticFetch, type BaseFetch, type StaticFetchOptions } from '../../app/features/static/staticFetch'
import { filterFrozenList, textQueryFallback } from '../../app/features/static/textQuery'

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

function fakeFetch() {
  const calls: { request: string; options?: StaticFetchOptions; raw?: boolean }[] = []
  const base = vi.fn(async (request: string, options?: StaticFetchOptions) => {
    calls.push({ request, options })
    return { code: 0, data: request }
  }) as unknown as BaseFetch
  base.raw = vi.fn(async (request: string, options?: StaticFetchOptions) => {
    calls.push({ request, options, raw: true })
    return { request }
  })
  base.create = vi.fn(() => base)
  return { base, calls }
}

describe('静态取数包装', () => {
  const setup = (fallback = vi.fn()) => {
    const { base, calls } = fakeFetch()
    const fetch = createStaticFetch(base, { apiBase: '/api/v1', origin: 'https://blog.example', fallback })
    return { fetch, calls, fallback }
  }

  it('公开 GET 改读冻结文件，去掉查询并附带原始键', async () => {
    const { fetch, calls } = setup()
    await fetch('/api/v1/posts', { query: { page: 2, pageSize: 15 }, timeout: 10000 })
    expect(calls[0]!.request).toBe(frozenApiFile('/posts?page=2&pageSize=15'))
    expect(calls[0]!.options).toMatchObject({ method: 'GET', query: undefined, timeout: 10000 })
    expect(new Headers(calls[0]!.options!.headers).get(FROZEN_SOURCE_HEADER)).toBe('/posts?page=2&pageSize=15')
    await fetch.raw('/api/v1/site')
    expect(calls[1]).toMatchObject({ request: frozenApiFile('/site'), raw: true })
  })

  it('非接口地址原样请求，写入请求直接拒绝且不发出', async () => {
    const { fetch, calls } = setup()
    await fetch('/_nuxt/builds/latest.json')
    expect(calls[0]!.request).toBe('/_nuxt/builds/latest.json')
    await expect(fetch('/api/v1/guestbook', { method: 'POST', body: {} })).rejects.toMatchObject({ statusCode: 405 })
    expect(calls).toHaveLength(1)
  })

  it('自由文本查询交给回退，并能读取冻结文件', async () => {
    const fallback = vi.fn(async (_key: string, load: (file: string) => Promise<unknown>) => load('/_api/all.json'))
    const { fetch, calls } = setup(fallback)
    await fetch('/api/v1/links', { query: { q: 'vue', page: 1 } })
    expect(fallback.mock.calls[0]![0]).toBe('/links?page=1&q=vue')
    expect(calls[0]!.request).toBe('/_api/all.json')
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
    const load = vi.fn(async () => ({ code: 0, data: { items } }))
    await expect(textQueryFallback('/flashes/search?q=nest', load)).resolves.toMatchObject({
      code: 0,
      data: { total: 1 },
    })
    expect(load).toHaveBeenCalledWith(frozenApiFile(frozenAllKey('/flashes')))
    await expect(textQueryFallback('/links?q=x', vi.fn().mockRejectedValue(new Error('404')))).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})
