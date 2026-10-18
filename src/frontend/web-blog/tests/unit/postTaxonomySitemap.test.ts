// @vitest-environment node
/** @file postTaxonomySitemap.test.ts @description 站点地图复用公开目录及页面地址，保留编码与真实上游失败边界。 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import type { PostMetadata } from '../../app/features/post/types'

const mocks = vi.hoisted(() => ({ metadata: vi.fn(), paged: vi.fn(), api: vi.fn() }))
vi.mock('../../server/utils/publicContent', () => ({
  publicMetadata: mocks.metadata,
  publicPagedItems: mocks.paged,
  publicApi: mocks.api,
}))

let handler: typeof import('../../server/api/__sitemap__/urls').default
const event = {} as H3Event
const metadata: PostMetadata = {
  tags: [
    { label: 'Vue 3 / 中文#入门?100%', slug: 'vue-3', color: 'blue', count: 3 },
    { label: '未使用标签', slug: 'unused', color: 'blue', count: 0 },
  ],
  categories: [
    { name: '前端 / 工程?实践#1%', count: 2 },
    { name: '空专栏', count: 0 },
  ],
  stats: { posts: 2, views: 0, comments: 0, tags: 1, siteAgeDays: 1 },
  archive: [
    {
      id: 1,
      slug: 'public-article',
      title: '公开文章',
      folder: '前端 / 工程?实践#1%',
      date: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 2,
      title: '不收录文章',
      folder: '前端 / 工程?实践#1%',
      date: '2026-09-02T00:00:00.000Z',
      seoNoindex: true,
    },
  ],
}

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (value: unknown) => value)
  handler = (await import('../../server/api/__sitemap__/urls')).default
})
beforeEach(() => {
  vi.resetAllMocks()
  mocks.metadata.mockResolvedValue(metadata)
  mocks.paged.mockResolvedValue([])
  mocks.api.mockResolvedValue({ topics: [] })
})
afterAll(() => vi.unstubAllGlobals())

describe('文章标签与专栏站点地图', () => {
  it('收录有公开文章的标签原名与专栏名称，保留中文和保留字符的单次路径编码', async () => {
    const entries = await handler(event)
    expect(entries).toEqual([
      { loc: '/articles/public-article', lastmod: '2026-10-01T00:00:00.000Z' },
      { loc: `/tags/${encodeURIComponent(metadata.tags[0]!.label)}`, _encoded: true },
      { loc: `/categories/${encodeURIComponent(metadata.categories[0]!.name)}`, _encoded: true },
    ])
    expect(mocks.metadata).toHaveBeenCalledExactlyOnceWith(event)
    expect(entries.some((entry) => entry.loc === '/tags/vue-3')).toBe(false)
    expect(entries.some((entry) => entry.loc === '/articles/2')).toBe(false)
  })

  it('目录为空时不生成占位路径或额外读取，其他公开来源继续收录', async () => {
    mocks.metadata.mockResolvedValue({ ...metadata, tags: [], categories: [], archive: [] })
    mocks.paged.mockImplementation((_event: H3Event, path: string) =>
      Promise.resolve(path === '/flashes' ? [{ id: 7, createdAt: '2026-10-02T00:00:00.000Z' }] : [{ id: 8 }]),
    )
    mocks.api.mockResolvedValue({ topics: [{ name: '日常' }] })
    expect(await handler(event)).toEqual([
      { loc: '/flash/7', lastmod: '2026-10-02T00:00:00.000Z' },
      { loc: '/moments/8' },
      { loc: '/moments/topic/日常' },
    ])
    expect(mocks.api).toHaveBeenCalledExactlyOnceWith(event, '/moments/overview')
    expect(mocks.paged).toHaveBeenCalledTimes(2)
  })

  it('非文章来源失败仍保留标签和专栏，文章目录失败继续向外报错', async () => {
    mocks.paged.mockRejectedValue(new Error('其他内容暂不可用'))
    mocks.api.mockRejectedValue(new Error('朋友圈概览暂不可用'))
    const entries = await handler(event)
    expect(entries).toHaveLength(3)
    expect(
      entries.filter((entry) => entry.loc.startsWith('/tags/') || entry.loc.startsWith('/categories/')),
    ).toHaveLength(2)
    const upstreamError = new Error('公开文章目录暂不可用')
    mocks.metadata.mockRejectedValue(upstreamError)
    await expect(handler(event)).rejects.toBe(upstreamError)
  })
})
