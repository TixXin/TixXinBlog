/** @file moment-read.service.spec.ts @description 朋友圈分页、公开投影、评论可见性与相邻动态的无数据库回归 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { NotFoundException } from '@nestjs/common'
import { MediaAsset } from '../../entities/media-asset.entity'
import { Moment } from '../../entities/moment.entity'
import { MomentComment } from '../../entities/moment-comment.entity'
import { MomentLike } from '../../entities/moment-like.entity'
import { Post } from '../../entities/post.entity'
import { QueryAdminMomentCommentsDto, QueryAdminMomentsDto, QueryMomentsDto } from './moment.dto'
import { MomentReadService } from './moment-read.service'

const createdAt = new Date('2026-10-17T02:00:00.000Z')
const publishedAt = new Date('2026-10-18T03:00:00.000Z')
const updatedAt = new Date('2026-10-18T04:00:00.000Z')
const visitor = 'hashed-visitor'
const mediaId = '12345678-1234-4123-a123-123456789abc'
const missingMediaId = '22345678-1234-4123-a123-123456789abc'
const mediaUrl = `/api/v1/media/${mediaId}.webp`
const cardFields = [
  '*',
  'linkedArticle.id',
  'linkedArticle.slug',
  'linkedArticle.title',
  'linkedArticle.summary',
  'linkedArticle.cover',
  'linkedArticle.status',
  'linkedArticle.deletedAt',
]

function moment(values: Partial<Moment> = {}) {
  return Object.assign(new Moment(), {
    id: 'moment-1',
    content: '傍晚沿河散步',
    status: 'published' as const,
    createdAt,
    publishedAt,
    updatedAt,
    revision: 4,
    requestId: 'private-request',
    requestHash: 'private-hash',
    ...values,
  })
}

function commentRow(id: string, momentId: string, time: Date, status = 'published') {
  return {
    id,
    moment_id: momentId,
    author: '山间来信',
    avatar: '/avatar.svg',
    content: '这片晚霞很美',
    created_at: time,
    is_owner: false,
    status,
    visitor_id_hash: visitor,
    request_id: 'private-request',
    request_hash: 'private-hash',
  }
}

function setup() {
  const connection = { execute: jest.fn().mockResolvedValue([]) }
  const em = {
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    getConnection: jest.fn(() => connection),
  }
  return { em, connection, service: new MomentReadService(em as unknown as EntityManager) }
}

describe('朋友圈列表与详情读取', () => {
  it('组合话题、UTC 日期和字面关键词筛选，稳定分页且只加载文章卡片列', async () => {
    const { em, service } = setup()
    em.findAndCount.mockResolvedValue([[moment()], 16])
    const query = Object.assign(new QueryMomentsDto(), {
      page: 2,
      pageSize: 5,
      topic: '生活',
      date: '2026-10-18',
      q: '100%_\\风景',
    })

    const result = await service.list(query)

    const [entity, where, options] = em.findAndCount.mock.calls[0]!
    expect(entity).toBe(Moment)
    expect(where.$and).toHaveLength(1)
    expect(where.$and[0]).toMatchObject({
      status: 'published',
      deletedAt: null,
      topics: { $contains: ['生活'] },
      publishedAt: { $gte: new Date('2026-10-18T00:00:00Z'), $lt: new Date('2026-10-19T00:00:00Z') },
    })
    const predicates = where.$and[0].$or as Record<string, unknown>[]
    expect(predicates).toHaveLength(3)
    expect(predicates[0]).toEqual({ content: { $ilike: '%100\\%\\_\\\\风景%' } })
    expect(predicates[1]).toEqual({ location: { $ilike: '%100\\%\\_\\\\风景%' } })
    expect(Object.values(predicates[2]!)).toEqual([{ $ilike: '%100\\%\\_\\\\风景%' }])
    expect(Object.keys(predicates[2]!)).toEqual([expect.stringContaining('.topics::text')])
    expect(options).toEqual({
      populate: ['linkedArticle'],
      fields: cardFields,
      orderBy: { isPinned: 'desc', publishedAt: 'desc', createdAt: 'desc', id: 'desc' },
      limit: 5,
      offset: 5,
    })
    expect(result).toMatchObject({
      items: [{ id: 'moment-1', content: '傍晚沿河散步' }],
      total: 16,
      page: 2,
      pageSize: 5,
    })
    expect(result.items[0]).not.toHaveProperty('revision')
  })

  it('纯时间订阅关闭置顶排序，空页保留总数且不查询互动', async () => {
    const { em, connection, service } = setup()
    em.findAndCount.mockResolvedValue([[], 8])
    expect(await service.list(Object.assign(new QueryMomentsDto(), { pinnedFirst: false, page: 3 }))).toEqual({
      items: [],
      total: 8,
      page: 3,
      pageSize: 15,
    })
    expect(em.findAndCount.mock.calls[0]![2].orderBy).toEqual({ publishedAt: 'desc', createdAt: 'desc', id: 'desc' })
    expect(connection.execute).not.toHaveBeenCalled()
    expect(em.find).not.toHaveBeenCalled()
  })

  it.each([undefined, 'all', 'draft', 'archived'] as const)('管理列表按 %s 筛选且始终排除删除项', async (status) => {
    const { em, service } = setup()
    await service.list(Object.assign(new QueryAdminMomentsDto(), { status }), '', true)
    expect(em.findAndCount.mock.calls[0]![1]).toEqual({
      $and: [{ deletedAt: null }, ...(status && status !== 'all' ? [{ status }] : [])],
    })
  })

  it.each([false, true])('详情按 admin=%s 校验可见性、刷新实体并使用同一投影', async (admin) => {
    const { em, service } = setup()
    em.findOne.mockResolvedValue(moment())
    const result = await service.detail('moment-1', visitor, admin)
    expect(em.findOne).toHaveBeenCalledWith(
      Moment,
      { id: 'moment-1', deletedAt: null, ...(admin ? {} : { status: 'published' }) },
      { populate: ['linkedArticle'], fields: cardFields, refresh: true },
    )
    expect(result).toMatchObject({ id: 'moment-1', date: publishedAt.toISOString() })
    expect(Object.hasOwn(result, 'revision')).toBe(admin)
    expect(em.find).toHaveBeenCalledWith(MomentLike, { moment: { $in: ['moment-1'] }, visitorIdHash: visitor })
  })

  it('不可见详情返回 404，不继续加载评论、点赞或媒体', async () => {
    const { em, connection, service } = setup()
    await expect(service.detail('missing', visitor)).rejects.toBeInstanceOf(NotFoundException)
    expect(connection.execute).not.toHaveBeenCalled()
    expect(em.find).not.toHaveBeenCalled()
  })

  it('提交结果只查未删除记录，再返回管理详情', async () => {
    const { em, service } = setup()
    em.findOne.mockResolvedValue(moment({ status: 'draft' }))
    const result = await service.submission('request-1')
    expect(em.findOne).toHaveBeenNthCalledWith(1, Moment, { requestId: 'request-1', deletedAt: null })
    expect(em.findOne.mock.calls[1]![1]).toEqual({ id: 'moment-1', deletedAt: null })
    expect(result).toMatchObject({ id: 'moment-1', status: 'draft', revision: 4 })
  })

  it('找不到提交结果时返回 404，不将已删除提交当作公开动态', async () => {
    const { em, service } = setup()
    await expect(service.submission('deleted-request')).rejects.toBeInstanceOf(NotFoundException)
    expect(em.findOne).toHaveBeenCalledTimes(1)
  })
})

describe('朋友圈公开与管理投影', () => {
  it('批量关联个人点赞、公开计数与受管图片说明，评论按时间和编号升序且不泄露内部字段', async () => {
    const { em, connection, service } = setup()
    const linked = Object.assign(new Post(), {
      id: 17,
      slug: 'river-walk',
      title: '沿河散步',
      summary: '一段安静的路',
      cover: 'https://example.com/cover.webp',
      contentRaw: '正文不应出现在卡片',
      contentSections: [{ type: 'paragraph', text: '结构化正文也不应出现在卡片' }],
    })
    const notes = [
      moment({
        images: [mediaUrl, 'https://example.com/river.webp', `/api/v1/media/${missingMediaId}.webp`],
        topics: ['生活'],
        likes: 12,
        linkedArticle: linked,
        isPinned: true,
      }),
      moment({ id: 'moment-2', publishedAt: null, images: [mediaUrl] }),
    ]
    connection.execute
      .mockResolvedValueOnce([
        commentRow('c3', 'moment-1', publishedAt, 'pending'),
        commentRow('other', 'moment-2', createdAt),
        commentRow('c2', 'moment-1', publishedAt),
        commentRow('c1', 'moment-1', createdAt),
      ])
      .mockResolvedValueOnce([{ moment_id: 'moment-1', count: 7 }])
    em.find.mockResolvedValueOnce([{ moment: notes[1] }]).mockResolvedValueOnce([{ id: mediaId, alt: '河边的柳树' }])

    const [first, second] = await service.serialize(notes, visitor, false)

    expect(first).toMatchObject({
      id: 'moment-1',
      images: notes[0]!.images,
      imageAlts: ['河边的柳树', '', ''],
      topics: ['生活'],
      likes: 12,
      isLiked: false,
      isPinned: true,
      commentCount: 7,
      date: publishedAt.toISOString(),
      linkedArticle: {
        id: '17',
        title: '沿河散步',
        summary: '一段安静的路',
        cover: 'https://example.com/cover.webp',
        url: '/articles/river-walk',
      },
    })
    expect(first!.comments.map((comment) => comment.id)).toEqual(['c1', 'c2', 'c3'])
    expect(first!.comments[2]).toEqual({
      id: 'c3',
      author: '山间来信',
      avatar: '/avatar.svg',
      content: '这片晚霞很美',
      time: publishedAt.toISOString(),
      isOwner: false,
      moderationStatus: 'pending',
    })
    expect(second).toMatchObject({
      id: 'moment-2',
      isLiked: true,
      commentCount: 0,
      imageAlts: ['河边的柳树'],
      date: createdAt.toISOString(),
      comments: [{ id: 'other' }],
    })
    for (const key of ['status', 'revision', 'linkedArticleId', 'createdAt', 'updatedAt', 'requestId', 'requestHash'])
      expect(first).not.toHaveProperty(key)
    expect(first!.linkedArticle).toEqual({
      id: '17',
      title: '沿河散步',
      summary: '一段安静的路',
      cover: 'https://example.com/cover.webp',
      url: '/articles/river-walk',
    })
    expect(em.find).toHaveBeenNthCalledWith(1, MomentLike, {
      moment: { $in: ['moment-1', 'moment-2'] },
      visitorIdHash: visitor,
    })
    expect(em.find).toHaveBeenNthCalledWith(2, MediaAsset, { id: { $in: [mediaId, missingMediaId] } })
    const calls = connection.execute.mock.calls as [string, unknown[]][]
    expect(calls).toHaveLength(2)
    expect(calls[0]![1]).toEqual(['moment-1', 'moment-2', visitor])
    expect(calls[0]![0]).toContain('moment_id in (?,?) and deleted_at is null')
    expect(calls[0]![0]).toContain("(status='published' or (status='pending' and visitor_id_hash=?))")
    expect(calls[0]![0]).toContain('partition by moment_id order by created_at desc,id desc')
    expect(calls[0]![0]).toContain('sequence <= 3')
    expect(calls[1]![1]).toEqual(['moment-1', 'moment-2'])
    expect(calls[1]![0]).toContain("and status='published' and deleted_at is null group by moment_id")
  })

  it('匿名读取使用隔离身份占位符，无受管图片时不额外查询媒体和点赞', async () => {
    const { em, connection, service } = setup()
    const [result] = await service.serialize([moment({ images: ['https://example.com/river.webp'] })], '', false)
    expect(connection.execute.mock.calls[0]![1]).toEqual(['moment-1', '__anonymous__'])
    expect(result).toMatchObject({ isLiked: false, commentCount: 0, comments: [], imageAlts: [''] })
    expect(em.find).not.toHaveBeenCalled()
  })

  it('管理投影可预览隐藏评论和编辑元数据，但不公开提交指纹', async () => {
    const { connection, service } = setup()
    connection.execute.mockResolvedValueOnce([commentRow('hidden', 'moment-1', createdAt, 'hidden')])
    const [result] = await service.serialize([moment({ status: 'archived' })], '', true)
    expect(result).toMatchObject({
      status: 'archived',
      revision: 4,
      linkedArticleId: null,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      comments: [{ id: 'hidden', moderationStatus: 'hidden' }],
    })
    expect(result).not.toHaveProperty('requestHash')
    expect(result).not.toHaveProperty('requestId')
    expect(connection.execute.mock.calls[0]![1]).toEqual(['moment-1'])
    expect(connection.execute.mock.calls[0]![0]).toContain('deleted_at is null and true')
    expect(connection.execute.mock.calls[1]![0]).toContain("status='published' and deleted_at is null")
  })

  it.each([
    { status: 'draft' as const },
    { status: 'archived' as const },
    { status: 'published' as const, deletedAt: updatedAt },
  ])('隐藏不可公开的引用文章 $status，包括管理预览中的公开卡片', async (values) => {
    const { service } = setup()
    const note = moment({ linkedArticle: Object.assign(new Post(), { id: 17, title: '私人文章', ...values }) })
    for (const admin of [false, true]) {
      const [result] = await service.serialize([note], '', admin)
      expect(result!.linkedArticle).toBeNull()
      if (admin) expect(result).toHaveProperty('linkedArticleId', 17)
      else expect(result).not.toHaveProperty('linkedArticleId')
    }
  })

  it('无自定义文章地址时使用数字编号，外链卡片保留原数据', async () => {
    const { service } = setup()
    const link = { title: '城市散步地图', url: 'https://example.com/walk' }
    const results = await service.serialize(
      [
        moment({ linkedArticle: Object.assign(new Post(), { id: 17, slug: '' }) }),
        moment({ id: 'moment-2', linkedLink: link }),
      ],
      '',
      false,
    )
    expect(results[0]!.linkedArticle!.url).toBe('/articles/17')
    expect(results[1]!.linkedLink).toEqual(link)
  })

  it('空输入直接返回，不建立连接或读取实体', async () => {
    const { em, service } = setup()
    expect(await service.serialize([], visitor, true)).toEqual([])
    expect(em.getConnection).not.toHaveBeenCalled()
    expect(em.find).not.toHaveBeenCalled()
  })

  it('评论聚合失败原样抛出，不回退为零统计', async () => {
    const { connection, service } = setup()
    const error = new Error('aggregate unavailable')
    connection.execute.mockRejectedValue(error)
    await expect(service.serialize([moment()], '', false)).rejects.toBe(error)
  })
})

describe('朋友圈评论分页', () => {
  it.each([
    { admin: false, visitor: '', identity: '__anonymous__' },
    { admin: false, visitor, identity: visitor },
    { admin: true, visitor: '', identity: '' },
  ])('admin=$admin、visitor=$visitor 时使用对应可见范围和稳定分页', async ({ admin, visitor, identity }) => {
    const { em, service } = setup()
    const note = moment()
    const comment = Object.assign(new MomentComment(), {
      id: 'comment-1',
      moment: note,
      author: '山间来信',
      avatar: '',
      content: '下次也去走走',
      visitorIdHash: 'private-visitor',
      requestId: 'private-request',
      requestHash: 'private-hash',
      createdAt,
    })
    em.findOne.mockResolvedValue(note)
    em.findAndCount.mockResolvedValue([[comment], 18])

    const result = await service.comments(note.id, { page: 2, pageSize: 5 }, visitor, admin)

    expect(em.findOne.mock.calls[0]![1]).toEqual({
      id: note.id,
      deletedAt: null,
      ...(admin ? {} : { status: 'published' }),
    })
    expect(em.findAndCount).toHaveBeenCalledWith(
      MomentComment,
      {
        moment: note.id,
        deletedAt: null,
        ...(admin ? {} : { $or: [{ status: 'published' }, { status: 'pending', visitorIdHash: identity }] }),
      },
      { orderBy: { createdAt: 'asc', id: 'asc' }, limit: 5, offset: 5 },
    )
    expect(result).toEqual({
      items: [
        {
          id: 'comment-1',
          author: '山间来信',
          avatar: '',
          content: '下次也去走走',
          time: createdAt.toISOString(),
          isOwner: false,
          moderationStatus: 'published',
        },
      ],
      total: 18,
      page: 2,
      pageSize: 5,
    })
  })

  it('所属动态不可见时不读取评论', async () => {
    const { em, service } = setup()
    await expect(service.comments('missing', { page: 1, pageSize: 15 }, visitor)).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(em.findAndCount).not.toHaveBeenCalled()
  })

  it.each([undefined, 'all', 'pending', 'hidden'] as const)(
    '后台评论列表状态 %s 保留未删除动态并截断预览',
    async (status) => {
      const { em, service } = setup()
      const note = moment({ content: '晚霞'.repeat(100), status: 'archived' })
      const comment = Object.assign(new MomentComment(), {
        id: 'c1',
        moment: note,
        author: '山间来信',
        avatar: '/avatar.svg',
        content: '喜欢这片安静的晚霞',
        status: status && status !== 'all' ? status : 'published',
        visitorIdHash: 'private-visitor',
        requestId: 'private-request',
        requestHash: 'private-hash',
        createdAt,
      })
      em.findAndCount.mockResolvedValue([[comment], 21])
      const result = await service.adminComments(
        Object.assign(new QueryAdminMomentCommentsDto(), { page: 2, pageSize: 10, status }),
      )
      expect(em.findAndCount).toHaveBeenCalledWith(
        MomentComment,
        { deletedAt: null, moment: { deletedAt: null }, ...(status && status !== 'all' ? { status } : {}) },
        { populate: ['moment'], orderBy: { createdAt: 'desc', id: 'desc' }, limit: 10, offset: 10 },
      )
      expect(result).toEqual({
        items: [
          {
            id: 'c1',
            author: '山间来信',
            avatar: '/avatar.svg',
            content: '喜欢这片安静的晚霞',
            time: createdAt.toISOString(),
            isOwner: false,
            moderationStatus: status && status !== 'all' ? status : 'published',
            momentId: note.id,
            momentContent: '晚霞'.repeat(80),
            momentStatus: 'archived',
          },
        ],
        total: 21,
        page: 2,
        pageSize: 10,
      })
      expect(result.items[0]).not.toHaveProperty('visitorIdHash')
    },
  )
})

describe('朋友圈相邻动态', () => {
  it('忽略置顶，按发布时间、创建时间和编号找到前后公开动态并截断正文', async () => {
    const { em, service } = setup()
    em.findOne
      .mockResolvedValueOnce(moment())
      .mockResolvedValueOnce(moment({ id: 'newer', content: '近况'.repeat(100) }))
      .mockResolvedValueOnce(moment({ id: 'older' }))
    expect(await service.navigation('moment-1')).toEqual({
      prev: { id: 'newer', content: '近况'.repeat(80) },
      next: { id: 'older', content: '傍晚沿河散步' },
    })
    for (const [index, direction, comparison] of [
      [1, 'asc', '$gt'],
      [2, 'desc', '$lt'],
    ] as const) {
      expect(em.findOne.mock.calls[index]).toEqual([
        Moment,
        {
          status: 'published',
          deletedAt: null,
          $or: [
            { publishedAt: { [comparison]: publishedAt } },
            { publishedAt, createdAt: { [comparison]: createdAt } },
            { publishedAt, createdAt, id: { [comparison]: 'moment-1' } },
          ],
        },
        { orderBy: { publishedAt: direction, createdAt: direction, id: direction } },
      ])
    }
  })

  it('没有相邻记录时返回空值，缺少发布时间时以创建时间构造边界', async () => {
    const { em, service } = setup()
    em.findOne.mockResolvedValueOnce(moment({ publishedAt: null }))
    expect(await service.navigation('moment-1')).toEqual({ prev: null, next: null })
    expect(em.findOne.mock.calls[1]![1].$or[0]).toEqual({ publishedAt: { $gt: createdAt } })
    expect(em.findOne.mock.calls[2]![1].$or[0]).toEqual({ publishedAt: { $lt: createdAt } })
  })

  it('当前动态不可见时不继续查找相邻记录', async () => {
    const { em, service } = setup()
    await expect(service.navigation('missing')).rejects.toBeInstanceOf(NotFoundException)
    expect(em.findOne).toHaveBeenCalledTimes(1)
  })
})
