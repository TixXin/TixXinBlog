/** @file post.service.spec.ts @description 公开文章搜索的字面匹配、分页与可见性，以及详情正文、标签和修订时间契约 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { Post } from '../../entities/post.entity'
import { PostRevision } from '../../entities/post-revision.entity'
import { QueryPostDto } from './dto/query-post.dto'
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

describe('公开文章搜索', () => {
  function setup(rows: ReturnType<typeof postRow>[] = [], total = rows.length) {
    const findAndCount = jest.fn().mockResolvedValue([rows, total])
    return { service: new PostService({ findAndCount } as unknown as EntityManager), findAndCount }
  }

  it.each([
    ['%', '%\\%%'],
    ['_', '%\\_%'],
    ['\\', '%\\\\%'],
    ['中文100%_\\路径', '%中文100\\%\\_\\\\路径%'],
  ])('标题、摘要、正文和标签中的 %s 均按字面搜索', async (search, expected) => {
    const { service, findAndCount } = setup()
    await service.findMany(Object.assign(new QueryPostDto(), { search }))
    expect(findAndCount).toHaveBeenCalledTimes(1)
    expect(findAndCount).toHaveBeenCalledWith(
      Post,
      {
        status: 'published',
        deletedAt: null,
        $or: [
          { title: { $ilike: expected } },
          { summary: { $ilike: expected } },
          { contentRaw: { $ilike: expected } },
          { tags: { label: { $ilike: expected } } },
        ],
      },
      expect.any(Object),
    )
  })

  it('组合分类、专栏、标签与非置顶筛选，第二页仍保留完整公开条件', async () => {
    const { service, findAndCount } = setup()
    await service.findMany(
      Object.assign(new QueryPostDto(), {
        search: '春日',
        category: 'life',
        folder: '随笔',
        tag: 'spring',
        pinned: false,
        page: 2,
        pageSize: 3,
      }),
    )
    expect(findAndCount).toHaveBeenCalledWith(
      Post,
      expect.objectContaining({
        status: 'published',
        deletedAt: null,
        category: 'life',
        folder: '随笔',
        tags: { slug: 'spring' },
        pinned: false,
        $or: expect.arrayContaining([{ contentRaw: { $ilike: '%春日%' } }]),
      }),
      expect.objectContaining({
        populate: ['tags'],
        orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
        limit: 3,
        offset: 3,
      }),
    )
  })

  it.each([
    ['date', 'publishedAt'],
    ['views', 'views'],
    ['likes', 'likes'],
  ] as const)('取消置顶优先并按 %s 升序时，以编号补足稳定排序', async (sort, field) => {
    const { service, findAndCount } = setup()
    await service.findMany(
      Object.assign(new QueryPostDto(), { search: '春日', sort, order: 'asc', pinnedFirst: false }),
    )
    expect(findAndCount.mock.calls[0]![2]).toMatchObject({
      orderBy: [{ [field]: 'asc' }, { id: 'asc' }],
      limit: 20,
      offset: 0,
    })
  })

  it('缺少关键词与全部分类时不增加搜索条件，仍只读取公开文章', async () => {
    const { service, findAndCount } = setup()
    await service.findMany(Object.assign(new QueryPostDto(), { category: 'all' }))
    expect(findAndCount.mock.calls[0]![1]).toEqual({ status: 'published', deletedAt: null })
  })

  it('分页响应保留真实总数，正文参与搜索但不进入列表投影', async () => {
    const { service, findAndCount } = setup([postRow({ slug: 'spring', category: 'life', pinned: false })], 9)
    const result = await service.findMany(Object.assign(new QueryPostDto(), { search: '正文', page: 2, pageSize: 1 }))
    expect(result).toEqual({
      items: [
        {
          id: 7,
          slug: 'spring',
          title: '春日记录',
          summary: '已有摘要',
          cover: undefined,
          tags: [{ label: 'Nuxt', color: 'sky' }],
          category: 'life',
          readTime: 4,
          likes: 2,
          views: 10,
          comments: 1,
          date: '2026-03-01T00:00:00.000Z',
          folder: '随笔',
          pinned: false,
        },
      ],
      total: 9,
      page: 2,
      pageSize: 1,
    })
    const options = findAndCount.mock.calls[0]![2]
    expect(options.fields).toEqual(expect.arrayContaining(['tags.label', 'tags.color', 'summary']))
    expect(options.fields).not.toEqual(expect.arrayContaining(['contentRaw']))
    expect(options.fields).not.toEqual(expect.arrayContaining(['contentSections']))
    expect(options).toMatchObject({ limit: 1, offset: 1 })
  })

  it.each([
    { page: 1, total: 0 },
    { page: 4, total: 5 },
  ])('空页 $page 保留筛选总数 $total', async ({ page, total }) => {
    const { service, findAndCount } = setup([], total)
    expect(await service.findMany(Object.assign(new QueryPostDto(), { search: '春日', page, pageSize: 2 }))).toEqual({
      items: [],
      total,
      page,
      pageSize: 2,
    })
    expect(findAndCount.mock.calls[0]![2]).toMatchObject({ limit: 2, offset: (page - 1) * 2 })
  })

  it('查询失败继续抛出原始错误，不伪装成零条结果', async () => {
    const { service, findAndCount } = setup()
    const error = new Error('文章检索不可用')
    findAndCount.mockRejectedValue(error)
    await expect(service.findMany(Object.assign(new QueryPostDto(), { search: '春日' }))).rejects.toBe(error)
  })
})

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
