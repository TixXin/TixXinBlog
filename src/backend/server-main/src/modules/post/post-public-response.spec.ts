/**
 * @file post-public-response.spec.ts
 * @description 公开文章读取白名单：列表、详情、历史地址与个人互动均隔离实体及修订内部字段。
 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { Post } from '../../entities/post.entity'
import { PostAddress } from '../../entities/post-address.entity'
import { PostLike } from '../../entities/post-like.entity'
import { PostRevision } from '../../entities/post-revision.entity'
import { QueryPostDto } from './dto/query-post.dto'
import { PostService } from './post.service'

const publishedAt = new Date('2026-03-01T00:00:00Z')
const revisedAt = new Date('2026-03-02T00:00:00Z')
const internalFields = {
  visitorIdHash: 'private-visitor-hash',
  ip: '192.0.2.48',
  email: 'private@example.test',
  requestId: 'private-request',
}
const sections = [
  { type: 'heading', id: 'start', level: 2, text: '开始' },
  { type: 'paragraph', text: '春日的第一段记录。' },
  { type: 'code', language: 'ts', text: 'const spring = true' },
  { type: 'quote', text: '春风又绿江南岸。' },
  { type: 'list', items: ['散步', '阅读'] },
]
const publicTags = [{ label: '生活', color: 'green' }]

function postRow(overrides: Record<string, unknown> = {}) {
  return {
    ...internalFields,
    id: 7,
    status: 'published',
    deletedAt: null,
    revision: 9,
    createdAt: new Date('2026-02-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    slug: 'spring',
    title: '春日记录',
    summary: '记录春日里的一点发现。',
    cover: '/media/spring.webp',
    coverAlt: '春日枝叶',
    seoTitle: '春日记录与发现',
    seoDescription: '关于春日的一篇记录。',
    seoNoindex: false,
    category: 'life',
    folder: '随笔',
    pinned: true,
    readTimeMinutes: 4,
    views: 12,
    likes: 3,
    commentCount: 2,
    contentRaw: '## 开始\n\n春日的第一段记录。',
    contentSections: sections,
    relatedContent: [],
    publishedAt,
    tags: {
      getItems: () => [{ ...internalFields, id: 4, slug: 'life', revision: 2, ...publicTags[0] }],
    },
    ...overrides,
  }
}

const publicListItem = {
  id: 7,
  slug: 'spring',
  title: '春日记录',
  summary: '记录春日里的一点发现。',
  cover: '/media/spring.webp',
  tags: publicTags,
  category: 'life',
  readTime: 4,
  likes: 3,
  views: 12,
  comments: 2,
  date: publishedAt.toISOString(),
  folder: '随笔',
  pinned: true,
}
const publicDetail = {
  id: '7',
  relatedContent: [],
  slug: 'spring',
  summary: '记录春日里的一点发现。',
  coverAlt: '春日枝叶',
  seoTitle: '春日记录与发现',
  seoDescription: '关于春日的一篇记录。',
  seoNoindex: false,
  title: '春日记录',
  cover: '/media/spring.webp',
  date: publishedAt.toISOString(),
  updatedAt: revisedAt.toISOString(),
  category: '随笔',
  tags: publicTags,
  readTime: '4 分钟',
  views: 12,
  likes: 3,
  comments: 2,
  contentRaw: '## 开始\n\n春日的第一段记录。',
  toc: [{ id: 'start', text: '开始', level: 2 }],
}

function setup(post = postRow()) {
  const revision = {
    ...internalFields,
    id: 91,
    post,
    revision: 9,
    reason: '内部修订说明',
    snapshot: { status: 'draft', contentRaw: '未发布修订正文' },
    createdAt: revisedAt,
  }
  const em = {
    findAndCount: jest.fn().mockResolvedValue([[post], 1]),
    findOne: jest.fn(async (entity: unknown) => {
      if (entity === Post) return post
      if (entity === PostRevision) return revision
      if (entity === PostAddress) return { ...internalFields, slug: 'old-spring', post, createdAt: publishedAt }
      if (entity === PostLike) return { ...internalFields, id: 81, post, createdAt: publishedAt }
      return null
    }),
    execute: jest.fn().mockResolvedValue([]),
  }
  return { em, service: new PostService(em as unknown as EntityManager) }
}

/** 与 HTTP JSON 序列化一致，缺省字段不会伪装成实际返回字段。 */
function json(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value))
}

describe('公开文章 GET 响应白名单', () => {
  it('列表仅返回卡片字段，标签实体与正文、状态、版本均不外泄', async () => {
    const { em, service } = setup()
    expect(json(await service.findMany(new QueryPostDto()))).toStrictEqual({
      items: [publicListItem],
      total: 1,
      page: 1,
      pageSize: 20,
    })
    expect(em.findAndCount).toHaveBeenCalledWith(
      Post,
      { status: 'published', deletedAt: null },
      expect.objectContaining({ populate: ['tags'] }),
    )
  })

  it.each(['编号', '历史地址'])('%s详情只返回公开正文与元数据，不展开修订快照或地址实体', async (entry) => {
    const { em, service } = setup()
    const result = entry === '编号' ? await service.findDetail(7) : await service.findBySlug('old-spring')
    expect(json(result)).toStrictEqual(publicDetail)
    expect(em.findOne).toHaveBeenCalledWith(Post, { id: 7, status: 'published', deletedAt: null }, expect.any(Object))
    expect(em.findOne).toHaveBeenCalledWith(PostRevision, { post: 7, revision: 9 }, { fields: ['createdAt'] })
    if (entry === '历史地址')
      expect(em.findOne).toHaveBeenCalledWith(PostAddress, {
        slug: 'old-spring',
        post: { status: 'published', deletedAt: null },
      })
  })

  it('旧结构化正文保持公开块契约，摘要兜底与目录不带实体字段', async () => {
    const { service } = setup(postRow({ contentRaw: undefined, summary: '' }))
    const detailWithoutRaw = { ...publicDetail }
    Reflect.deleteProperty(detailWithoutRaw, 'contentRaw')
    expect(json(await service.findDetail(7))).toStrictEqual({
      ...detailWithoutRaw,
      summary: '',
      excerpt: '春日的第一段记录。',
      content: sections,
    })
  })

  it('关联卡片只公开仍可见的目标，不带草稿、回收目标或目标实体内部字段', async () => {
    const { em, service } = setup(
      postRow({
        relatedContent: [
          { type: 'post', id: 20 },
          { type: 'project', id: 21 },
          { type: 'gallery', id: 22 },
          { type: 'post', id: 23 },
          { type: 'post', id: 24 },
          { type: 'project', id: 25 },
        ],
      }),
    )
    em.execute.mockResolvedValue([
      { ...postRow(), type: 'post', id: 20, title: '另一篇随笔', slug: 'another', deleted_at: null },
      { ...postRow(), type: 'project', id: 21, title: '花园计划', deleted_at: null },
      { ...postRow(), type: 'gallery', id: 22, title: '春日照片', deleted_at: null },
      { ...postRow(), type: 'post', id: 23, title: '私有草稿标题', status: 'draft', deleted_at: null },
      { ...postRow(), type: 'post', id: 24, title: '回收文章标题', deleted_at: publishedAt },
      { ...postRow(), type: 'project', id: 25, title: '撤回项目标题', status: 'withdrawn', deleted_at: null },
    ])
    expect(json(await service.findDetail(7))).toStrictEqual({
      ...publicDetail,
      relatedContent: [
        { type: 'post', id: 20, title: '另一篇随笔', url: '/articles/another' },
        { type: 'project', id: 21, title: '花园计划', url: '/projects?project=21' },
        { type: 'gallery', id: 22, title: '春日照片', url: '/gallery?photo=22' },
      ],
    })
  })

  it.each(['visitor', ''])('互动读取只返回计数与当前访客布尔状态：%s', async (visitor) => {
    const { em, service } = setup()
    expect(json(await service.interaction(7, visitor))).toStrictEqual({ liked: !!visitor, likes: 3, views: 12 })
    expect(em.findOne).toHaveBeenCalledWith(
      Post,
      { id: 7, status: 'published', deletedAt: null },
      { fields: ['id', 'likes', 'views'] },
    )
    if (visitor)
      expect(em.findOne).toHaveBeenCalledWith(PostLike, {
        post: expect.objectContaining({ id: 7 }),
        visitorIdHash: visitor,
      })
    else expect(em.findOne).toHaveBeenCalledTimes(1)
  })

  it.each(['detail', 'slug', 'interaction'] as const)('%s 对不可见文章只返回不存在，不暴露内部状态', async (entry) => {
    const { em, service } = setup()
    em.findOne.mockResolvedValue(null)
    const request =
      entry === 'detail'
        ? service.findDetail(7)
        : entry === 'slug'
          ? service.findBySlug('private-draft')
          : service.interaction(7, 'visitor')
    await expect(request).rejects.toMatchObject({ code: 1001, message: '文章不存在' })
    expect(em.findOne).toHaveBeenCalledTimes(1)
    expect(em.execute).not.toHaveBeenCalled()
  })
})
