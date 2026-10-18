/** @file guestbook-public-response.spec.ts @description 留言公开列表、详情、引用与侧栏聚合的 JSON 白名单和个人待审边界。 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { GuestbookMessage } from '../../entities/guestbook-message.entity'
import { QueryGuestbookDto } from './guestbook.dto'
import { GuestbookReadService } from './guestbook-read.service'

const date = new Date('2026-10-18T01:00:00.000Z')
const visitor = 'private-guestbook-visitor-hash'
const privateFields = {
  visitorIdHash: visitor,
  ip: '192.0.2.48',
  email: 'private@example.invalid',
  requestId: 'private-request-id',
  requestHash: 'private-request-hash',
  revision: 48,
}

function fixture(values: Partial<GuestbookMessage> = {}): GuestbookMessage {
  return Object.assign(new GuestbookMessage(), privateFields, {
    id: 48,
    author: '读者',
    avatar: '/avatar.svg',
    content: '读完旅行记录，也想沿着河岸走一走',
    browser: 'Firefox 130',
    region: '新加坡',
    createdAt: date,
    updatedAt: date,
    deletedAt: null,
    replyTo: null,
    ...values,
  })
}

function setup() {
  const note = fixture()
  const em = {
    findOne: jest.fn().mockResolvedValue(note),
    count: jest.fn().mockResolvedValue(1),
    find: jest.fn().mockResolvedValue([note]),
    execute: jest.fn().mockResolvedValue([
      {
        ...privateFields,
        message_id: note.id,
        visitor_id_hash: visitor,
        emoji: '👍',
        count: 2,
        reacted: true,
      },
    ]),
  }
  return { service: new GuestbookReadService(em as unknown as EntityManager), em, note }
}

function json<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

const expectedMessage = {
  id: 48,
  author: '读者',
  avatar: '/avatar.svg',
  content: '读完旅行记录，也想沿着河岸走一走',
  createdAt: date.toISOString(),
  isOwner: false,
  isPinned: false,
  browser: 'Firefox 130',
  region: '新加坡',
  moderationStatus: 'published',
  replyTo: null,
  replyUnavailable: false,
  reactions: [{ emoji: '👍', count: 2, reacted: true }],
}

describe('留言公开 GET 响应白名单', () => {
  it.each(['list', 'detail'] as const)('%s 仅返回展示字段，移除访客身份、提交标识与版本', async (route) => {
    const { service, em } = setup()
    const result = route === 'list' ? await service.list(new QueryGuestbookDto()) : await service.detail(48)
    expect(json(result)).toStrictEqual(
      route === 'list' ? { items: [expectedMessage], total: 1, nextCursor: null } : expectedMessage,
    )
    const visibility = { deletedAt: null, $or: [{ status: 'published' }] }
    if (route === 'list') {
      expect(em.count.mock.calls[0]![1]).toEqual({ $and: [visibility, {}] })
      expect(em.find.mock.calls[0]![1]).toEqual({ $and: [visibility, {}] })
    } else {
      expect(em.findOne.mock.calls[0]![1]).toEqual({ $and: [{ id: 48 }, visibility] })
    }
    expect(em.execute.mock.calls[0]![1]).toEqual(['__anonymous__', 48])
  })

  it.each(['list', 'detail'] as const)('%s 允许本人待审展示，同时保持完全相同的字段白名单', async (route) => {
    const { service, em, note } = setup()
    note.status = 'pending'
    const result =
      route === 'list' ? await service.list(new QueryGuestbookDto(), visitor) : await service.detail(48, visitor)
    const expected = { ...expectedMessage, moderationStatus: 'pending' }
    expect(json(result)).toStrictEqual(route === 'list' ? { items: [expected], total: 1, nextCursor: null } : expected)
    const visibility = {
      deletedAt: null,
      $or: [{ status: 'published' }, { status: 'pending', visitorIdHash: visitor }],
    }
    const where = (route === 'list' ? em.find : em.findOne).mock.calls[0]![1]
    expect(where).toEqual({ $and: route === 'list' ? [visibility, {}] : [{ id: 48 }, visibility] })
    expect(JSON.stringify(result)).not.toContain(visitor)
  })

  it.each([
    ['published', null, 'other-visitor', '', true],
    ['pending', null, visitor, visitor, true],
    ['pending', null, visitor, '', false],
    ['pending', null, 'other-visitor', visitor, false],
    ['hidden', null, visitor, visitor, false],
    ['published', date, visitor, visitor, false],
  ] as const)(
    '引用状态 %s / 删除 %s / 归属 %s / 当前访客 %s 的可见性为 %s',
    async (status, deletedAt, author, identity, visible) => {
      const { service, note } = setup()
      note.replyTo = fixture({
        id: 49,
        author: '原留言作者',
        content: '原留言内容',
        status,
        deletedAt,
        visitorIdHash: author,
      })
      expect(json((await service.serialize([note], identity))[0])).toStrictEqual({
        ...expectedMessage,
        replyTo: visible ? { id: 49, author: '原留言作者', content: '原留言内容' } : null,
        replyUnavailable: !visible,
      })
    },
  )

  it('历史留言缺少浏览器与地区时省略可选字段，不带入其他内部属性', async () => {
    const { service, note } = setup()
    note.browser = null
    note.region = null
    const expected: Partial<typeof expectedMessage> = { ...expectedMessage }
    delete expected.browser
    delete expected.region
    expect(json((await service.serialize([note]))[0])).toStrictEqual(expected)
  })

  it('分页游标只含稳定边界与筛选指纹，不编码访客身份和内容', async () => {
    const { service, em, note } = setup()
    em.find.mockResolvedValue([note, fixture({ id: 47 })])
    em.count.mockResolvedValue(2)
    const result = await service.list(Object.assign(new QueryGuestbookDto(), { pageSize: 1 }), visitor)
    expect(json(result)).toStrictEqual({ items: [expectedMessage], total: 2, nextCursor: expect.any(String) })
    expect(JSON.parse(Buffer.from(result.nextCursor!, 'base64url').toString())).toStrictEqual({
      v: 1,
      id: 48,
      at: date.toISOString(),
      scope: expect.stringMatching(/^[0-9a-f]{64}$/),
    })
  })

  it('不存在或不可见的详情返回 404，不读取回应或返回管理状态', async () => {
    const { service, em } = setup()
    em.findOne.mockResolvedValue(null)
    await expect(service.detail(48)).rejects.toMatchObject({ status: 404 })
    expect(em.findOne.mock.calls[0]![1]).toEqual({
      $and: [{ id: 48 }, { deletedAt: null, $or: [{ status: 'published' }] }],
    })
    expect(em.execute).not.toHaveBeenCalled()
  })

  it('侧栏仅统计公开留言，成员使用公开编号，置顶留言仍执行字段和引用过滤', async () => {
    const { service, em, note } = setup()
    note.isPinned = true
    note.replyTo = fixture({ id: 49, status: 'hidden', content: '不可见原文' })
    em.execute
      .mockResolvedValueOnce([{ messages: 2, members: 1, recent: 2, today: 1 }])
      .mockResolvedValueOnce([
        { ...privateFields, member: visitor, author: '读者', avatar: '/avatar.svg', count: 2, is_owner: false },
      ])
    const result = await service.metadata(visitor)
    expect(json(result)).toStrictEqual({
      stats: { messages: 2, members: 1, recent: 2, today: 1 },
      pinned: { ...expectedMessage, isPinned: true, replyUnavailable: true },
      members: [
        {
          id: expect.stringMatching(/^[0-9a-f]{20}$/),
          name: '读者',
          avatar: '/avatar.svg',
          messageCount: 2,
          isOwner: false,
        },
      ],
      rules: [
        { id: 1, text: '欢迎分享技术经验、阅读感受和生活见闻。' },
        { id: 2, text: '请友善交流，尊重不同意见。' },
        { id: 3, text: '请勿发布个人隐私、广告或与讨论无关的内容。' },
      ],
    })
    expect(JSON.stringify(result)).not.toContain(visitor)
    expect(em.findOne).toHaveBeenCalledWith(
      GuestbookMessage,
      { status: 'published', deletedAt: null, isPinned: true },
      { populate: ['replyTo'] },
    )
    expect(em.execute.mock.calls[0]![0]).toContain("where status='published' and deleted_at is null")
    expect(em.execute.mock.calls[0]![0]).toMatch(/^select count\(\*\)::int as messages,/)
    expect(em.execute.mock.calls[1]![0]).toContain("where status='published' and deleted_at is null")
  })
})
