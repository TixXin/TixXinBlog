/** @file moment-public-response.spec.ts @description 朋友圈公开 GET 的动态、引用、评论、导航与聚合响应字段白名单。 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { Moment } from '../../entities/moment.entity'
import { MomentComment } from '../../entities/moment-comment.entity'
import { Post } from '../../entities/post.entity'
import { MomentPageQuery, QueryMomentsDto } from './moment.dto'
import { MomentReadService } from './moment-read.service'

const date = new Date('2026-10-18T01:00:00.000Z')
const visitor = 'private-moment-visitor-hash'
const privateFields = {
  visitorIdHash: visitor,
  ip: '192.0.2.48',
  email: 'private@example.invalid',
  revision: 48,
  requestId: 'private-request-id',
  requestHash: 'private-request-hash',
}
const publicWhere = { status: 'published', deletedAt: null }

function fixture(): Moment {
  return Object.assign(new Moment(), privateFields, {
    id: 'moment-public',
    content: '周末在街角遇见一家书店',
    topics: ['阅读'],
    images: ['https://example.invalid/bookstore.webp'],
    location: '街角书店',
    device: '相机',
    mood: '平静',
    likes: 3,
    isPinned: true,
    status: 'published' as const,
    publishedAt: date,
    createdAt: date,
    updatedAt: date,
    linkedArticle: Object.assign(new Post(), privateFields, {
      id: 48,
      slug: 'reading-weekend',
      title: '周末读书',
      summary: '关于阅读的记录',
      cover: 'https://example.invalid/book.webp',
      status: 'published' as const,
      deletedAt: null,
      contentRaw: '不属于卡片响应的文章原文',
      content: [{ type: 'paragraph', text: '不属于卡片响应的正文' }],
    }),
    linkedLink: null,
  })
}

function commentFixture(status: MomentComment['status'] = 'published') {
  return Object.assign(new MomentComment(), privateFields, {
    id: 'moment-comment',
    moment: fixture(),
    author: '读者',
    avatar: '/avatar.svg',
    content: '这家书店很安静',
    createdAt: date,
    status,
    deletedAt: null,
  })
}

function setup() {
  const note = fixture()
  const execute = jest.fn().mockImplementation((sql: string) =>
    Promise.resolve(
      sql.includes('row_number()')
        ? [
            {
              ...privateFields,
              id: 'moment-comment',
              moment_id: note.id,
              visitor_id_hash: visitor,
              request_hash: 'private-request-hash',
              author: '读者',
              avatar: '/avatar.svg',
              content: '这家书店很安静',
              created_at: date,
              is_owner: false,
              status: 'published',
              deleted_at: null,
              sequence: 1,
            },
          ]
        : [{ moment_id: note.id, count: 1 }],
    ),
  )
  const em = {
    findAndCount: jest.fn().mockResolvedValue([[note], 1]),
    findOne: jest.fn().mockResolvedValue(note),
    find: jest.fn().mockResolvedValue([]),
    getConnection: () => ({ execute }),
    fork: jest.fn(),
  }
  return { service: new MomentReadService(em as unknown as EntityManager), em, execute, note }
}

function json<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

const expectedComment = {
  id: 'moment-comment',
  author: '读者',
  avatar: '/avatar.svg',
  content: '这家书店很安静',
  time: date.toISOString(),
  isOwner: false,
  moderationStatus: 'published',
}
const expectedNote = {
  id: 'moment-public',
  content: '周末在街角遇见一家书店',
  images: ['https://example.invalid/bookstore.webp'],
  imageAlts: [''],
  date: date.toISOString(),
  location: '街角书店',
  device: '相机',
  mood: '平静',
  topics: ['阅读'],
  likes: 3,
  isLiked: false,
  isPinned: true,
  commentCount: 1,
  comments: [expectedComment],
  linkedArticle: {
    id: '48',
    title: '周末读书',
    summary: '关于阅读的记录',
    cover: 'https://example.invalid/book.webp',
    url: '/articles/reading-weekend',
  },
  linkedLink: null,
}

describe('朋友圈公开 GET 响应白名单', () => {
  it.each(['list', 'detail'] as const)('%s 剔除动态内部字段、评论身份和文章正文', async (route) => {
    const { service, em, execute } = setup()
    const result = route === 'list' ? await service.list(new QueryMomentsDto()) : await service.detail('moment-public')
    expect(json(result)).toStrictEqual(
      route === 'detail' ? expectedNote : { items: [expectedNote], total: 1, page: 1, pageSize: 15 },
    )
    if (route === 'list') {
      expect(em.findAndCount.mock.calls[0]![1]).toEqual({ $and: [publicWhere] })
    } else {
      expect(em.findOne.mock.calls[0]![1]).toEqual({ id: 'moment-public', ...publicWhere })
    }
    const options = (route === 'list' ? em.findAndCount : em.findOne).mock.calls[0]![2]
    expect(options.fields).toEqual([
      '*',
      'linkedArticle.id',
      'linkedArticle.slug',
      'linkedArticle.title',
      'linkedArticle.summary',
      'linkedArticle.cover',
      'linkedArticle.status',
      'linkedArticle.deletedAt',
    ])
    expect(execute.mock.calls[0]![0]).toContain(
      "deleted_at is null and (status='published' or (status='pending' and visitor_id_hash=?))",
    )
    expect(execute.mock.calls[0]![1]).toEqual(['moment-public', '__anonymous__'])
    expect(execute.mock.calls[1]![0]).toContain("and status='published' and deleted_at is null")
  })

  it.each([
    { status: 'draft', deletedAt: null },
    { status: 'published', deletedAt: date },
  ] as const)('不公开关联文章 %j 的标题、摘要或正文', async (visibility) => {
    const { service, note } = setup()
    Object.assign(note.linkedArticle!, visibility)
    expect(json((await service.serialize([note], '', false))[0])).toStrictEqual({
      ...expectedNote,
      linkedArticle: null,
    })
  })

  it('外链引用只包含契约中的展示信息', async () => {
    const { service, note } = setup()
    const link = {
      url: 'https://example.invalid/reading',
      title: '阅读清单',
      description: '本月计划阅读的书',
      image: 'https://example.invalid/books.webp',
      siteName: '读书笔记',
      favicon: 'https://example.invalid/favicon.ico',
    }
    note.linkedArticle = null
    note.linkedLink = link
    expect(json((await service.serialize([note], '', false))[0])).toStrictEqual({
      ...expectedNote,
      linkedArticle: null,
      linkedLink: {
        url: 'https://example.invalid/reading',
        title: '阅读清单',
        description: '本月计划阅读的书',
        image: 'https://example.invalid/books.webp',
        siteName: '读书笔记',
        favicon: 'https://example.invalid/favicon.ico',
      },
    })
  })

  it.each(['', visitor])('评论分页只允许公开或本人待审记录，访客身份 %j 不出现在 JSON 中', async (identity) => {
    const { service, em } = setup()
    const status = identity ? 'pending' : 'published'
    em.findAndCount.mockResolvedValue([[commentFixture(status)], 1])
    expect(json(await service.comments('moment-public', new MomentPageQuery(), identity))).toStrictEqual({
      items: [{ ...expectedComment, moderationStatus: status }],
      total: 1,
      page: 1,
      pageSize: 15,
    })
    expect(em.findOne.mock.calls[0]![1]).toEqual({ id: 'moment-public', ...publicWhere })
    expect(em.findAndCount).toHaveBeenCalledWith(
      MomentComment,
      {
        moment: 'moment-public',
        deletedAt: null,
        $or: [{ status: 'published' }, { status: 'pending', visitorIdHash: identity || '__anonymous__' }],
      },
      expect.any(Object),
    )
  })

  it('携带访客的动态预览只查询本人待审评论，公开计数不包含待审', async () => {
    const { service, execute } = setup()
    await service.detail('moment-public', visitor)
    expect(execute.mock.calls[0]![1]).toEqual(['moment-public', visitor])
    expect(execute.mock.calls[0]![0]).toContain("(status='published' or (status='pending' and visitor_id_hash=?))")
    expect(execute.mock.calls[1]![0]).toContain("status='published' and deleted_at is null")
  })

  it('受管媒体只补充图片说明，不公开存储键和媒体内部记录', async () => {
    const { service, em, note } = setup()
    const mediaId = '00000000-0000-4000-8000-000000000048'
    const url = `/api/v1/media/${mediaId}.webp`
    note.images = [url]
    em.find.mockResolvedValue([{ ...privateFields, id: mediaId, alt: '书店的橱窗', storageKey: 'private/storage/key' }])
    expect(json((await service.serialize([note], '', false))[0])).toStrictEqual({
      ...expectedNote,
      images: [url],
      imageAlts: ['书店的橱窗'],
    })
  })

  it('导航只返回公开相邻动态的编号和摘录', async () => {
    const { service, em, note } = setup()
    em.findOne.mockResolvedValueOnce(note).mockResolvedValueOnce(note).mockResolvedValueOnce(null)
    expect(json(await service.navigation(note.id))).toStrictEqual({
      prev: { id: note.id, content: note.content },
      next: null,
    })
    for (const [, where] of em.findOne.mock.calls) expect(where).toMatchObject(publicWhere)
  })

  it('非公开动态的详情、评论与导航统一拒绝读取，不返回管理状态', async () => {
    const { service, em, execute } = setup()
    em.findOne.mockResolvedValue(null)
    await expect(service.detail('private')).rejects.toMatchObject({ status: 404 })
    await expect(service.comments('private', new MomentPageQuery())).rejects.toMatchObject({ status: 404 })
    await expect(service.navigation('private')).rejects.toMatchObject({ status: 404 })
    for (const [, where] of em.findOne.mock.calls) expect(where).toEqual({ id: 'private', ...publicWhere })
    expect(em.findAndCount).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
  })

  it('概览只返回公开聚合、照片和摘录，不携带完整动态与关联文章', async () => {
    const { service, em, execute, note } = setup()
    execute
      .mockResolvedValueOnce([{ totalMoments: 1, totalLikes: 3, totalComments: 1 }])
      .mockResolvedValueOnce([{ name: '阅读', count: 1 }])
      .mockResolvedValueOnce([{ date: '2026-10-18', count: 1 }])
    const reader = {
      find: jest.fn().mockResolvedValue([note]),
      findOne: jest.fn().mockResolvedValue(null),
    }
    em.fork.mockReturnValue(reader)
    expect(json(await service.overview())).toStrictEqual({
      stats: { totalMoments: 1, totalLikes: 3, totalComments: 1 },
      topics: [{ name: '阅读', count: 1 }],
      dates: [{ date: '2026-10-18', count: 1 }],
      photos: [{ src: 'https://example.invalid/bookstore.webp', momentId: 'moment-public' }],
      recollections: [{ id: 'moment-public', content: note.content, date: date.toISOString() }],
    })
    for (const [statement] of execute.mock.calls) {
      expect(statement).toContain("status='published' and deleted_at is null")
      expect(statement).not.toMatch(/select\s+\*/i)
    }
    expect(execute.mock.calls[0]![0]).toContain("c.status='published' and c.deleted_at is null")
    for (const [, where] of reader.find.mock.calls) expect(where).toMatchObject(publicWhere)
    expect(reader.find.mock.calls[0]![2].fields).toEqual(['id', 'images'])
    expect(reader.find.mock.calls[1]![2].fields).toEqual(['id', 'content', 'publishedAt', 'createdAt'])
  })
})
