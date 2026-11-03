/** @file staticPostSearch.test.ts @description 静态站文章搜索：在列表全量与正文索引上按后端规则匹配，正文命中附上 contentMatch，其余筛选与分页沿用列表回退 */
import { describe, expect, it, vi } from 'vitest'
import { frozenAllKey, frozenCorpusKey } from '../../app/features/static/frozenApi'
import { postSearchFallback, searchFrozenPosts } from '../../app/features/static/postSearch'
import { staticQueryFallback } from '../../app/features/static/queryFallback'

const posts = [
  {
    id: 1,
    slug: 'static-guide',
    title: '静态发布指南',
    summary: '把站点导出成纯静态文件',
    cover: '/api/v1/media/search-cover.webp',
    tags: [{ label: 'Nuxt', color: 'sky' }],
  },
  { id: 2, slug: 'search', title: '随笔', summary: '一段日常', tags: [{ label: '生活', color: 'rose' }] },
  { id: 3, slug: 'notes', title: '读书笔记', summary: '摘抄', tags: [{ label: 'Nuxt', color: 'sky' }] },
]
const corpus = new Map([
  ['1', '# 指南\n\n正文介绍构建流程。'],
  ['2', '今天试了试 **Pagefind** 的中文分词。'],
  ['3', ''],
])

function ids(result: { items: Array<Record<string, unknown>> }) {
  return result.items.map((item) => item.id)
}

describe('静态站文章搜索', () => {
  it('标题、摘要、标签名与正文任一命中，不区分大小写', () => {
    expect(ids(searchFrozenPosts('/posts?search=静态', posts, corpus))).toEqual([1])
    expect(ids(searchFrozenPosts('/posts?search=nuxt', posts, corpus))).toEqual([1, 3])
    expect(ids(searchFrozenPosts('/posts?search=pagefind', posts, corpus))).toEqual([2])
  })

  it('不匹配封面地址、slug 等后端不检索的字段', () => {
    expect(searchFrozenPosts('/posts?search=search', posts, corpus).total).toBe(0)
    expect(searchFrozenPosts('/posts?search=sky', posts, corpus).total).toBe(0)
  })

  it('正文命中的条目附上与后端同规则的 contentMatch，只命中标题时不带', () => {
    const [hit] = searchFrozenPosts('/posts?search=pagefind', posts, corpus).items
    expect(hit).toMatchObject({ id: 2, contentMatch: '今天试了试 **Pagefind** 的中文分词。' })
    const [title] = searchFrozenPosts('/posts?search=读书', posts, corpus).items
    expect(title).not.toHaveProperty('contentMatch')
  })

  it('其余筛选与分页沿用列表回退', () => {
    const page = searchFrozenPosts('/posts?page=2&pageSize=1&search=nuxt', posts, corpus)
    expect(page).toMatchObject({ total: 2, page: 2, pageSize: 1 })
    expect(ids(page)).toEqual([3])
    expect(ids(searchFrozenPosts('/posts?search=nuxt&tag=生活', posts, corpus))).toEqual([])
  })

  it('同时读取列表全量与正文索引，任一缺失时给出 404', async () => {
    const files = new Map<string, unknown>([
      [frozenAllKey('/posts'), { code: 0, data: { items: posts } }],
      [
        frozenCorpusKey('/posts'),
        { code: 0, data: { items: [...corpus].map(([id, contentRaw]) => ({ id: Number(id), contentRaw })) } },
      ],
    ])
    const load = vi.fn(async (key: string) =>
      files.has(key) ? new Response(JSON.stringify(files.get(key))) : new Response('{}', { status: 404 }),
    )
    const response = await postSearchFallback('/posts?search=构建', load)
    expect(await response.json()).toMatchObject({ code: 0, data: { total: 1, items: [{ id: 1 }] } })
    files.delete(frozenCorpusKey('/posts'))
    await expect(postSearchFallback('/posts?search=构建', load)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('查询回退入口只把文章关键词搜索交给正文索引', async () => {
    const load = vi.fn(async () => new Response(JSON.stringify({ code: 0, data: { items: [] } })))
    await staticQueryFallback('/posts?search=x', load)
    expect(load.mock.calls.map(([key]) => key)).toEqual([frozenAllKey('/posts'), frozenCorpusKey('/posts')])
    load.mockClear()
    await staticQueryFallback('/posts?page=9', load)
    await staticQueryFallback('/links?q=x', load)
    expect(load.mock.calls.map(([key]) => key)).toEqual([frozenAllKey('/posts'), frozenAllKey('/links')])
  })
})
