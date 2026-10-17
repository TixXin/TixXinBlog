/** @file post.service.spec.ts @description 公开文章详情不重复返回正文，提供标签、内容修订时间与摘要兜底 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { Post } from '../../entities/post.entity'
import { PostRevision } from '../../entities/post-revision.entity'
import { contentUpdatedAt, PostService } from './post.service'

const sections = [
  { type: 'heading' as const, level: 2, text: '开始', id: 'start' },
  { type: 'paragraph' as const, text: '第一段正文用于摘要兜底。' },
]

function postRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    revision: 3,
    slug: undefined,
    title: '春日记录',
    summary: '已有摘要',
    cover: undefined,
    folder: '随笔',
    readTimeMinutes: 4,
    views: 10,
    likes: 2,
    commentCount: 1,
    relatedContent: [],
    contentRaw: '## 开始\n\n第一段正文用于摘要兜底。',
    contentSections: sections,
    publishedAt: new Date('2026-03-01T00:00:00Z'),
    // 浏览计数会刷新实体 updatedAt，公开详情不应采用
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    tags: { getItems: () => [{ label: 'Nuxt', color: 'sky' }] },
    ...overrides,
  }
}

function serviceFor(post: ReturnType<typeof postRow> | null, revisedAt: Date | null) {
  const findOne = jest.fn(async (entity: unknown) => {
    if (entity === Post) return post
    if (entity === PostRevision) return revisedAt ? { createdAt: revisedAt } : null
    return null
  })
  return { service: new PostService({ findOne } as unknown as EntityManager), findOne }
}

describe('公开文章详情', () => {
  it('有 Markdown 原文时只返回原文与目录，不再重复返回结构化正文', async () => {
    const { service, findOne } = serviceFor(postRow(), new Date('2026-03-05T10:00:00Z'))
    const detail = await service.findDetail(7)
    expect(detail.contentRaw).toContain('## 开始')
    expect(detail).not.toHaveProperty('content')
    expect(detail.toc).toEqual([{ id: 'start', text: '开始', level: 2 }])
    expect(detail.tags).toEqual([{ label: 'Nuxt', color: 'sky' }])
    expect(detail.updatedAt).toBe('2026-03-05T10:00:00.000Z')
    expect(detail).not.toHaveProperty('excerpt')
    // 修订时间按当前修订号读取单列
    expect(findOne).toHaveBeenCalledWith(PostRevision, { post: 7, revision: 3 }, { fields: ['createdAt'] })
  })

  it('旧文章没有原文时继续返回结构化正文，缺摘要时提供首段摘录', async () => {
    const { service } = serviceFor(postRow({ contentRaw: undefined, summary: '' }), null)
    const detail = await service.findDetail(7)
    expect(detail.content).toEqual(sections)
    expect(detail).not.toHaveProperty('contentRaw')
    expect(detail.excerpt).toBe('第一段正文用于摘要兜底。')
    // 缺少修订快照时回退发布时间
    expect(detail.updatedAt).toBe('2026-03-01T00:00:00.000Z')
  })

  it('文章不存在时返回 1001 业务错误', async () => {
    const { service } = serviceFor(null, null)
    await expect(service.findDetail(404)).rejects.toMatchObject({ code: 1001 })
  })
})

describe('内容修订时间', () => {
  const published = new Date('2026-03-01T00:00:00Z')
  it('修订晚于发布时取修订时间', () => {
    expect(contentUpdatedAt(published, new Date('2026-03-02T00:00:00Z')).toISOString()).toBe('2026-03-02T00:00:00.000Z')
  })
  it.each([null, undefined, new Date('2026-02-01T00:00:00Z')])('修订缺失或早于发布时回退发布时间 %#', (revised) => {
    expect(contentUpdatedAt(published, revised)).toBe(published)
  })
})
