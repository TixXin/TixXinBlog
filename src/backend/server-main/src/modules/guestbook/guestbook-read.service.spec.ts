/** @file guestbook-read.service.spec.ts @description 留言公开读取、稳定分页、引用隐私、回应与成员统计的单元测试 */
import 'reflect-metadata'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import type { EntityManager } from '@mikro-orm/postgresql'
import { GuestbookMessage } from '../../entities/guestbook-message.entity'
import { GuestbookReadService } from './guestbook-read.service'
import { GUESTBOOK_RULES } from './guestbook-values'

function note(id = 1, patch: Partial<GuestbookMessage> = {}): GuestbookMessage {
  return Object.assign(new GuestbookMessage(), {
    id,
    visitorIdHash: 'visitor-private-hash',
    author: '山间来客',
    avatar: '/avatar.png',
    content: '这篇阅读记录让我想起了山里的书店。',
    requestId: '1a22e7ab-8701-4fe4-9b3c-7780dff3cb44',
    requestHash: 'submission-private-hash',
    revision: 7,
    browser: 'Firefox 132',
    region: '新加坡',
    deletedAt: null,
    createdAt: new Date('2026-10-18T00:15:00.000Z'),
    updatedAt: new Date('2026-10-18T01:00:00.000Z'),
    ...patch,
  })
}

function setup() {
  const em = {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    execute: jest.fn().mockResolvedValue([]),
  }
  return { em, service: new GuestbookReadService(em as unknown as EntityManager) }
}

describe('留言公开读取与分页', () => {
  it.each([
    ['匿名访客', '', { deletedAt: null, $or: [{ status: 'published' }] }],
    [
      '有身份访客',
      'reader-hash',
      { deletedAt: null, $or: [{ status: 'published' }, { status: 'pending', visitorIdHash: 'reader-hash' }] },
    ],
  ])('%s 详情查询仅包含公开和本人可见记录', async (_label, visitor, visibility) => {
    const { em, service } = setup()
    const message = note()
    em.findOne.mockResolvedValue(message)

    expect(await service.require(1, visitor)).toBe(message)
    expect(em.findOne).toHaveBeenCalledWith(
      GuestbookMessage,
      { $and: [{ id: 1 }, visibility] },
      { populate: ['replyTo'], refresh: true },
    )
  })

  it('管理读取允许所有未删除状态，但仍排除软删除记录', async () => {
    const { em, service } = setup()
    const message = note(1, { status: 'hidden' })
    em.findOne.mockResolvedValue(message)

    expect(await service.require(1, '', true)).toBe(message)
    expect(em.findOne).toHaveBeenCalledWith(
      GuestbookMessage,
      { $and: [{ id: 1 }, { deletedAt: null }] },
      { populate: ['replyTo'], refresh: true },
    )
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2147483648])(
    '非法编号 %s 在读取持久层前被拒绝',
    async (id) => {
      const { em, service } = setup()

      await expect(service.require(id)).rejects.toBeInstanceOf(BadRequestException)
      expect(em.findOne).not.toHaveBeenCalled()
    },
  )

  it('不存在或不可见详情返回统一错误，且不读取回应', async () => {
    const { em, service } = setup()

    await expect(service.detail(1, 'reader-hash')).rejects.toThrow(new NotFoundException('留言不存在或暂不可见'))
    expect(em.execute).not.toHaveBeenCalled()
  })

  it('关键词按字面转义，日期按 UTC 半开区间筛选，总数与列表使用相同可见范围', async () => {
    const { em, service } = setup()
    const query = { pageSize: 2, q: '100%_\\', date: '2026-10-18' }

    expect(await service.list(query, 'reader-hash')).toEqual({ items: [], total: 0, nextCursor: null })
    const filters = [
      { deletedAt: null, $or: [{ status: 'published' }, { status: 'pending', visitorIdHash: 'reader-hash' }] },
      {
        $or: [{ content: { $ilike: '%100\\%\\_\\\\%' } }, { author: { $ilike: '%100\\%\\_\\\\%' } }],
        createdAt: { $gte: new Date('2026-10-18T00:00:00.000Z'), $lt: new Date('2026-10-19T00:00:00.000Z') },
      },
    ]
    expect(em.count).toHaveBeenCalledWith(GuestbookMessage, { $and: filters })
    expect(em.find).toHaveBeenCalledWith(
      GuestbookMessage,
      { $and: filters },
      { populate: ['replyTo'], orderBy: { createdAt: 'desc', id: 'desc' }, limit: 3 },
    )
    expect(em.execute).not.toHaveBeenCalled()
  })

  it('多取一条判断后页，游标使用最后返回记录并以编号稳定区分同一时间的留言', async () => {
    const { em, service } = setup()
    const messages = [note(8), note(7), note(6)]
    em.count.mockResolvedValue(9)
    em.find.mockResolvedValueOnce(messages).mockResolvedValueOnce([messages[2]])

    const first = await service.list({ pageSize: 2 })
    expect(first.items.map((item) => item.id)).toEqual([8, 7])
    expect(first.total).toBe(9)
    expect(first.nextCursor).toEqual(expect.any(String))
    expect(em.execute).toHaveBeenCalledWith(expect.any(String), ['__anonymous__', 8, 7])

    const second = await service.list({ pageSize: 2, before: first.nextCursor! })
    expect(second.items.map((item) => item.id)).toEqual([6])
    expect(second.nextCursor).toBeNull()
    expect(second.total).toBe(9)
    const filters = [{ deletedAt: null, $or: [{ status: 'published' }] }, {}]
    expect(em.count).toHaveBeenNthCalledWith(2, GuestbookMessage, { $and: filters })
    expect(em.find).toHaveBeenNthCalledWith(
      2,
      GuestbookMessage,
      {
        $and: [
          ...filters,
          {
            $or: [
              { createdAt: { $lt: messages[1]!.createdAt } },
              { createdAt: messages[1]!.createdAt, id: { $lt: 7 } },
            ],
          },
        ],
      },
      { populate: ['replyTo'], orderBy: { createdAt: 'desc', id: 'desc' }, limit: 3 },
    )
  })

  it('恰好满页没有多取记录时不产生后页游标', async () => {
    const { em, service } = setup()
    em.find.mockResolvedValue([note(2), note(1)])
    em.count.mockResolvedValue(2)

    expect(await service.list({ pageSize: 2 })).toMatchObject({ total: 2, nextCursor: null })
  })

  it('游标绑定筛选条件，切换关键词后拒绝沿用旧游标', async () => {
    const { em, service } = setup()
    em.find.mockResolvedValue([note(2), note(1)])
    const first = await service.list({ pageSize: 1, q: '山里' })
    em.find.mockClear()
    em.execute.mockClear()

    await expect(service.list({ pageSize: 1, q: '城市', before: first.nextCursor! })).rejects.toThrow(
      '留言游标无效或筛选已变化，请重新加载',
    )
    expect(em.find).not.toHaveBeenCalled()
    expect(em.execute).not.toHaveBeenCalled()
  })

  it('损坏游标拒绝查询列表', async () => {
    const { em, service } = setup()

    await expect(service.list({ pageSize: 20, before: 'broken-cursor' })).rejects.toBeInstanceOf(BadRequestException)
    expect(em.find).not.toHaveBeenCalled()
  })
})

describe('留言公开投影与引用隐私', () => {
  it('详情保留可展示来源与审核结果，移除访客身份、提交标识和管理字段', async () => {
    const { em, service } = setup()
    em.findOne.mockResolvedValue(note(1, { status: 'pending' }))

    expect(await service.detail(1, 'visitor-private-hash')).toEqual({
      id: 1,
      author: '山间来客',
      avatar: '/avatar.png',
      content: '这篇阅读记录让我想起了山里的书店。',
      createdAt: '2026-10-18T00:15:00.000Z',
      isOwner: false,
      isPinned: false,
      browser: 'Firefox 132',
      region: '新加坡',
      moderationStatus: 'pending',
      replyTo: null,
      replyUnavailable: false,
      reactions: [],
    })
  })

  it.each([null, undefined])('旧记录来源为 %s 时不向 JSON 输出空值', async (source) => {
    const { service } = setup()
    const [result] = await service.serialize([note(1, { browser: source, region: source })])

    expect(result!.browser).toBeUndefined()
    expect(result!.region).toBeUndefined()
    expect(JSON.parse(JSON.stringify(result))).not.toHaveProperty('browser')
    expect(JSON.parse(JSON.stringify(result))).not.toHaveProperty('region')
  })

  it('公开父留言只返回引用所需作者与正文', async () => {
    const { service } = setup()
    const parent = note(1)
    const [result] = await service.serialize([note(2, { replyTo: parent })])

    expect(result!.replyTo).toEqual({ id: 1, author: parent.author, content: parent.content })
    expect(result!.replyUnavailable).toBe(false)
  })

  it.each([
    ['隐藏', { status: 'hidden' as const }, 'visitor-private-hash'],
    ['删除', { deletedAt: new Date('2026-10-18T02:00:00.000Z') }, 'visitor-private-hash'],
    ['其他访客待审', { status: 'pending' as const }, 'another-reader'],
    ['匿名读取待审', { status: 'pending' as const, visitorIdHash: '' }, ''],
  ])('%s 父留言不可见时保留回复并移除引用内容', async (_label, patch, visitor) => {
    const { service } = setup()
    const parent = note(1, { author: '父留言私有作者', content: '父留言私有正文', ...patch })
    const [result] = await service.serialize([note(2, { replyTo: parent })], visitor)

    expect(result).toMatchObject({ id: 2, replyTo: null, replyUnavailable: true })
    expect(JSON.stringify(result)).not.toContain(parent.author)
    expect(JSON.stringify(result)).not.toContain(parent.content)
  })

  it('本人可以看到自己的待审父引用', async () => {
    const { service } = setup()
    const parent = note(1, { status: 'pending' })
    const [result] = await service.serialize([note(2, { replyTo: parent })], 'visitor-private-hash')

    expect(result).toMatchObject({
      replyTo: { id: 1, author: parent.author, content: parent.content },
      replyUnavailable: false,
    })
  })

  it('管理员投影附带版本及父引用状态，仍不返回身份和提交哈希', async () => {
    const { service } = setup()
    const parent = note(1, { status: 'hidden', deletedAt: new Date('2026-10-18T02:00:00.000Z') })
    const [result] = await service.serialize([note(2, { replyTo: parent })], '', true)

    expect(result).toMatchObject({
      revision: 7,
      updatedAt: '2026-10-18T01:00:00.000Z',
      replyTo: { id: 1, author: parent.author, content: parent.content, status: 'hidden', deleted: true },
      replyUnavailable: false,
    })
    expect(result).not.toHaveProperty('visitorIdHash')
    expect(result).not.toHaveProperty('requestHash')
    expect(result).not.toHaveProperty('requestId')
  })

  it('回应按留言分组、按固定顺序展示，并保留当前访客的目标状态', async () => {
    const { em, service } = setup()
    em.execute.mockResolvedValue([
      { message_id: 1, emoji: '💡', count: 2, reacted: false },
      { message_id: 2, emoji: '❤️', count: 1, reacted: true },
      { message_id: 1, emoji: '👍', count: 3, reacted: true },
    ])

    const results = await service.serialize([note(1), note(2)], 'reader-hash')
    expect(results.map((item) => item.reactions)).toEqual([
      [
        { emoji: '👍', count: 3, reacted: true },
        { emoji: '💡', count: 2, reacted: false },
      ],
      [{ emoji: '❤️', count: 1, reacted: true }],
    ])
    expect(em.execute).toHaveBeenCalledWith(
      expect.stringContaining('count(*)::int as count,bool_or(visitor_id_hash=?) as reacted'),
      ['reader-hash', 1, 2],
    )
    expect(em.execute.mock.calls[0]![0]).toContain('where message_id in (?,?) group by message_id,emoji')
  })

  it('空记录无需执行回应聚合', async () => {
    const { em, service } = setup()

    expect(await service.serialize([])).toEqual([])
    expect(em.execute).not.toHaveBeenCalled()
  })
})

describe('留言侧栏成员统计与公开置顶', () => {
  it('统计与成员仅查询公开未删除记录，博主身份合并，今日按 UTC 日期计算', async () => {
    const { em, service } = setup()
    const stats = { messages: 12, members: 3, recent: 8, today: 2 }
    em.execute.mockResolvedValueOnce([stats]).mockResolvedValueOnce([
      { member: '__owner__', author: '山行', avatar: '/owner.png', count: 8, is_owner: true },
      { member: 'reader-hash', author: '海边来客', avatar: '', count: 3, is_owner: false },
    ])

    const result = await service.metadata()
    expect(result.stats).toEqual(stats)
    expect(result.members).toEqual([
      {
        id: expect.stringMatching(/^[0-9a-f]{20}$/),
        name: '山行',
        avatar: '/owner.png',
        messageCount: 8,
        isOwner: true,
      },
      { id: expect.stringMatching(/^[0-9a-f]{20}$/), name: '海边来客', avatar: '', messageCount: 3, isOwner: false },
    ])
    expect(result.members[0]!.id).not.toBe(result.members[1]!.id)
    expect(JSON.stringify(result)).not.toContain('reader-hash')
    expect(JSON.stringify(result)).not.toContain('__owner__')
    expect(result.rules).toEqual(GUESTBOOK_RULES)
    expect(result.pinned).toBeNull()

    const statsSql = em.execute.mock.calls[0]![0] as string
    expect(statsSql).toContain("count(distinct case when is_owner then '__owner__' else visitor_id_hash end)")
    expect(statsSql).toContain("created_at>=now()-interval '30 days'")
    expect(statsSql).toContain("(created_at at time zone 'UTC')::date=(now() at time zone 'UTC')::date")
    expect(statsSql).toContain("where status='published' and deleted_at is null")
    const membersSql = em.execute.mock.calls[1]![0] as string
    expect(membersSql).toContain("case when is_owner then '__owner__' else visitor_id_hash end as member")
    expect(membersSql).toContain("where status='published' and deleted_at is null")
    expect(membersSql).toContain('count(*)::int as count from visible group by member')
    expect(membersSql).toContain('order by member,created_at desc,id desc')
    expect(membersSql).toContain('order by totals.count desc,latest.member limit 6')
  })

  it('同一成员改名或头像变化不会改变公开编号', async () => {
    const { em, service } = setup()
    const stats = { messages: 1, members: 1, recent: 1, today: 1 }
    const member = { member: 'reader-hash', author: '海边来客', avatar: '', count: 1, is_owner: false }
    em.execute
      .mockResolvedValueOnce([stats])
      .mockResolvedValueOnce([member])
      .mockResolvedValueOnce([stats])
      .mockResolvedValueOnce([{ ...member, author: '看海的人', avatar: '/sea.png' }])

    const before = await service.metadata()
    const after = await service.metadata()
    expect(after.members[0]!.id).toBe(before.members[0]!.id)
    expect(after.members[0]).toMatchObject({ name: '看海的人', avatar: '/sea.png' })
  })

  it('置顶只读取公开未删除记录，并沿用当前访客的回应和引用隐私投影', async () => {
    const { em, service } = setup()
    const stats = { messages: 1, members: 1, recent: 1, today: 1 }
    em.execute
      .mockResolvedValueOnce([stats])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ message_id: 9, emoji: '👍', count: 2, reacted: true }])
    em.findOne.mockResolvedValue(note(9, { isPinned: true, replyTo: note(2, { status: 'hidden' }) }))

    const result = await service.metadata('reader-hash')
    expect(em.findOne).toHaveBeenCalledWith(
      GuestbookMessage,
      { status: 'published', deletedAt: null, isPinned: true },
      { populate: ['replyTo'] },
    )
    expect(result.pinned).toMatchObject({
      id: 9,
      isPinned: true,
      replyTo: null,
      replyUnavailable: true,
      reactions: [{ emoji: '👍', count: 2, reacted: true }],
    })
    expect(result.pinned).not.toHaveProperty('revision')
    expect(em.execute).toHaveBeenLastCalledWith(expect.any(String), ['reader-hash', 9])
  })

  it('无公开留言时保留真实零统计和交流规则，不补充样本或查询回应', async () => {
    const { em, service } = setup()
    const stats = { messages: 0, members: 0, recent: 0, today: 0 }
    em.execute.mockResolvedValueOnce([stats]).mockResolvedValueOnce([])

    expect(await service.metadata()).toEqual({ stats, members: [], pinned: null, rules: GUESTBOOK_RULES })
    expect(em.execute).toHaveBeenCalledTimes(2)
  })

  it('统计读取失败原样传播，不补零统计或继续查询成员与置顶', async () => {
    const { em, service } = setup()
    const error = new Error('统计读取失败')
    em.execute.mockRejectedValueOnce(error)

    await expect(service.metadata()).rejects.toBe(error)
    expect(em.execute).toHaveBeenCalledTimes(1)
    expect(em.findOne).not.toHaveBeenCalled()
  })
})
