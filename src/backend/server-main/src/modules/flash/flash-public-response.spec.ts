/** @file flash-public-response.spec.ts @description 公开闪念列表、搜索、详情和概览的 JSON 白名单及可见性边界。 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { ConfigService } from '@nestjs/config'
import { FlashComment } from '../../entities/flash-comment.entity'
import { FlashNote } from '../../entities/flash-note.entity'
import { QueryFlashDto, SearchFlashDto } from './dto/query-flash.dto'
import { FlashService } from './flash.service'

const date = new Date('2026-10-18T01:00:00.000Z')
const visitor = 'private-flash-visitor-hash'
const privateFields = {
  visitorIdHash: visitor,
  ip: '192.0.2.48',
  email: 'private@example.invalid',
  revision: 48,
  requestId: 'private-request-id',
  requestHash: 'private-request-hash',
}
const publicWhere = { userId: 'tixxin', isDraft: false, isArchived: false }

function fixture() {
  const note = Object.assign(new FlashNote(), privateFields, {
    id: 'flash-public',
    userId: 'tixxin',
    content: '雨停后去河边走走',
    tags: ['生活'],
    images: ['https://example.invalid/river.webp'],
    type: 'memo' as const,
    likes: 3,
    isPinned: true,
    createdAt: date,
    updatedAt: date,
  })
  jest.spyOn(note.comments, 'getItems').mockReturnValue([
    Object.assign(new FlashComment(), privateFields, {
      id: 'flash-comment',
      flashNote: note,
      authorId: visitor,
      authorName: '读者',
      authorAvatar: '/avatar.svg',
      content: '沿岸的风景很美',
      createdAt: date,
    }),
  ])
  return note
}

function setup() {
  const execute = jest.fn().mockResolvedValue([])
  const em = {
    findAndCount: jest.fn().mockResolvedValue([[fixture()], 1]),
    findOne: jest.fn().mockResolvedValue(fixture()),
    find: jest.fn().mockResolvedValue([]),
    getConnection: () => ({ execute }),
  }
  const service = new FlashService(
    em as unknown as EntityManager,
    new ConfigService({ JWT_ACCESS_SECRET: 'flash-whitelist-secret-at-least-32-characters' }),
  )
  return { service, em, execute }
}

function json<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

const expectedNote = {
  id: 'flash-public',
  userId: 'tixxin',
  content: '雨停后去河边走走',
  tags: ['生活'],
  images: ['https://example.invalid/river.webp'],
  imageAlts: [''],
  type: 'memo',
  createdAt: date.toISOString(),
  updatedAt: date.toISOString(),
  likes: 3,
  liked: false,
  commentCount: 1,
  comments: [
    {
      id: 'flash-comment',
      authorId: expect.stringMatching(/^[0-9a-f]{20}$/),
      authorName: '读者',
      authorAvatar: '/avatar.svg',
      content: '沿岸的风景很美',
      createdAt: date.toISOString(),
      moderationStatus: 'published',
    },
  ],
  isPinned: true,
  // 这是既有公开契约中的兼容字段；公开读取必须将其限定为 false。
  isArchived: false,
  isDraft: false,
}

describe('闪念公开 GET 响应白名单', () => {
  it.each(['list', 'search', 'detail'] as const)('%s 仅序列化公开字段，评论不携带访客哈希与实体关系', async (route) => {
    const { service, em } = setup()
    const query = new QueryFlashDto()
    const result =
      route === 'list'
        ? await service.findMany(query)
        : route === 'search'
          ? await service.search(Object.assign(new SearchFlashDto(), { q: '河边' }))
          : await service.findOne('flash-public')
    expect(json(result)).toStrictEqual(
      route === 'detail' ? expectedNote : { items: [expectedNote], total: 1, page: 1, pageSize: 20 },
    )
    for (const value of [visitor, privateFields.ip, privateFields.email, privateFields.requestHash]) {
      expect(JSON.stringify(result)).not.toContain(value)
    }
    if (route === 'detail') {
      expect(em.findOne).toHaveBeenCalledWith(FlashNote, { id: 'flash-public', ...publicWhere }, expect.any(Object))
    } else {
      expect(em.findAndCount.mock.calls[0]![1]).toEqual(
        route === 'list' ? publicWhere : { $and: [publicWhere, expect.any(Object)] },
      )
    }
  })

  it('不可公开的详情返回不存在，不绕过草稿和归档过滤再次加载', async () => {
    const { service, em } = setup()
    em.findOne.mockResolvedValue(null)
    await expect(service.findOne('private-flash')).rejects.toMatchObject({ status: 404 })
    expect(em.findOne).toHaveBeenCalledTimes(1)
    expect(em.findOne.mock.calls[0]![1]).toEqual({ id: 'private-flash', ...publicWhere })
    expect(em.find).not.toHaveBeenCalled()
  })

  it('受管媒体只补充图片说明，不展开存储键和媒体内部记录', async () => {
    const { service, em } = setup()
    const note = fixture()
    const mediaId = '00000000-0000-4000-8000-000000000048'
    const url = `/api/v1/media/${mediaId}.webp`
    note.images = [url]
    em.find.mockResolvedValue([{ ...privateFields, id: mediaId, alt: '雨后的河岸', storageKey: 'private/storage/key' }])
    expect(json((await service.serialize([note], ''))[0])).toStrictEqual({
      ...expectedNote,
      images: [url],
      imageAlts: ['雨后的河岸'],
    })
  })

  it('概览限定聚合列及公开范围，回顾和点赞记录只返回允许字段', async () => {
    const { service, execute } = setup()
    execute
      .mockResolvedValueOnce([{ total: 2, monthCount: 1 }])
      .mockResolvedValueOnce([{ date: '2026-10-18', count: 1 }])
      .mockResolvedValueOnce([{ name: '生活', count: 2 }])
      .mockResolvedValueOnce([{ ...privateFields, id: 'anniversary', content: '去年今日', created_at: date }])
      .mockResolvedValueOnce([{ ...privateFields, id: 'recollection', content: '河边散步', created_at: date }])
      .mockResolvedValueOnce([{ ...privateFields, id: 'flash-public' }])
    expect(json(await service.overview(visitor, date))).toStrictEqual({
      total: 2,
      monthCount: 1,
      dates: [{ date: '2026-10-18', count: 1 }],
      tags: [{ name: '生活', count: 2 }],
      onThisDay: { id: 'anniversary', content: '去年今日', createdAt: date.toISOString() },
      recollections: [{ id: 'recollection', content: '河边散步', createdAt: date.toISOString() }],
      likedIds: ['flash-public'],
    })
    const sql = execute.mock.calls.map(([statement]: [string]) => statement.replace(/\s+/g, ' '))
    expect(sql).toHaveLength(6)
    expect(sql.every((statement) => /is_draft = false and (?:n\.)?is_archived = false/.test(statement))).toBe(true)
    expect(sql[0]).toContain('select count(*)::int as total, (count(*) filter')
    expect(sql[1]).toContain(
      "select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD') as date, count(*)::int as count",
    )
    expect(sql[2]).toContain('select tag as name, count(*)::int as count')
    expect(sql[5]).toContain('select l.flash_note_id as id')
    expect(execute.mock.calls[5]![1]).toEqual([visitor, 'tixxin'])
  })
})
