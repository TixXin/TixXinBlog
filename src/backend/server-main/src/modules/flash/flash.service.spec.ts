/**
 * @file flash.service.spec.ts
 * @description 闪念回归：评论公开 authorId 不暴露访客哈希、头像白名单；公开列表与搜索的筛选组合和排序；
 *   公开概览只做聚合查询、按访客返回已赞编号
 */
import { createHash } from 'node:crypto'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { ConfigService } from '@nestjs/config'
import type { EntityManager } from '@mikro-orm/postgresql'
import { FlashComment } from '../../entities/flash-comment.entity'
import type { FlashNote } from '../../entities/flash-note.entity'
import { FlashService } from './flash.service'
import { QueryFlashDto, SearchFlashDto } from './dto/query-flash.dto'

const secret = 'flash-test-secret-with-at-least-32-characters'
const visitor = createHash('sha256').update('visitor-device-1').digest('hex')

function setup(config: Record<string, string> = { JWT_ACCESS_SECRET: secret }) {
  const note = { id: 'note-1', likes: 0 }
  const em = {
    transactional: jest.fn(),
    execute: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(note),
    create: jest.fn((_entity: unknown, data: Record<string, unknown>) => ({ id: 'comment-1', ...data })),
    flush: jest.fn().mockResolvedValue(undefined),
    count: jest.fn().mockResolvedValue(0),
    nativeDelete: jest.fn().mockResolvedValue(0),
    find: jest.fn().mockResolvedValue([]),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    connection: { execute: jest.fn().mockResolvedValue([]) },
    getConnection: jest.fn(),
  }
  em.getConnection.mockImplementation(() => em.connection)
  em.transactional.mockImplementation((run: (manager: unknown) => unknown) => run(em))
  return { em, service: new FlashService(em as unknown as EntityManager, new ConfigService(config)) }
}

const dto = { authorName: '访客', content: '写得真好' }

describe('FlashService 评论身份', () => {
  it('公开 authorId 为稳定的 20 位 HMAC，不等于访客哈希或留言成员编号', async () => {
    const { service, em } = setup()
    const created = await service.addComment('note-1', dto, visitor)
    expect(em.create).toHaveBeenCalledWith(FlashComment, expect.objectContaining({ authorId: visitor }))
    expect(created.authorId).toMatch(/^[0-9a-f]{20}$/)
    expect(created.authorId).not.toBe(visitor)
    expect(visitor).not.toContain(created.authorId)
    const member = createHash('sha256')
      .update('member:' + visitor)
      .digest('hex')
      .slice(0, 20)
    expect(created.authorId).not.toBe(member)
    expect((await service.addComment('note-1', dto, visitor)).authorId).toBe(created.authorId)
    expect((await service.addComment('note-1', dto, 'another-visitor')).authorId).not.toBe(created.authorId)
  })

  it('换用密钥后标识随之变化，列表序列化同样不返回原始哈希', async () => {
    const first = setup()
    const second = setup({ JWT_ACCESS_SECRET: secret.replace('flash', 'other') })
    const note = {
      id: 'note-1',
      userId: 'tixxin',
      content: '',
      tags: [],
      images: [],
      type: 'text',
      createdAt: new Date(0),
      updatedAt: new Date(0),
      likes: 0,
      comments: {
        getItems: () => [
          { id: 'c1', authorId: visitor, authorName: '访客', authorAvatar: '', content: 'x', createdAt: new Date(0) },
        ],
      },
      isPinned: false,
      isArchived: false,
      isDraft: false,
    } as unknown as FlashNote
    const [a] = await first.service.serialize([note], '')
    const [b] = await second.service.serialize([note], '')
    expect(a!.comments[0]!.authorId).toMatch(/^[0-9a-f]{20}$/)
    expect(a!.comments[0]!.authorId).not.toBe(visitor)
    expect(a!.comments[0]!.authorId).not.toBe(b!.comments[0]!.authorId)
  })

  it.each(['javascript:alert(1)', 'data:image/png;base64,AAAA', 'ftp://example.com/a.png', '/etc/passwd'])(
    '拒绝头像 %s',
    async (authorAvatar) => {
      const { service, em } = setup()
      await expect(service.addComment('note-1', { ...dto, authorAvatar }, visitor)).rejects.toMatchObject({
        status: 400,
      })
      expect(em.create).not.toHaveBeenCalled()
    },
  )

  it('缺省使用默认头像，合法 HTTPS 头像与空值保持原有行为', async () => {
    const { service } = setup()
    expect((await service.addComment('note-1', dto, visitor)).authorAvatar).toBe('/avatar.svg')
    expect(
      (await service.addComment('note-1', { ...dto, authorAvatar: 'https://q1.qlogo.cn/g?b=qq&nk=1&s=100' }, visitor))
        .authorAvatar,
    ).toBe('https://q1.qlogo.cn/g?b=qq&nk=1&s=100')
    expect((await service.addComment('note-1', { ...dto, authorAvatar: '' }, visitor)).authorAvatar).toBe('')
  })
})

const query = (input: Record<string, unknown>) => plainToInstance(QueryFlashDto, input)
const searchQuery = (input: Record<string, unknown>) => plainToInstance(SearchFlashDto, input)

describe('FlashService 公开列表与搜索筛选', () => {
  it('类型、标签与单日筛选组合，日期按 UTC 日边界，排序置顶优先', async () => {
    const { service, em } = setup()
    await service.findMany(query({ type: 'idea', tag: '技术', date: '2026-10-14', page: '2', pageSize: '5' }))
    const [, where, options] = em.findAndCount.mock.calls[0]!
    expect(where).toEqual({
      userId: 'tixxin',
      isDraft: false,
      isArchived: false,
      tags: { $contains: ['技术'] },
      type: 'idea',
      createdAt: { $gte: new Date('2026-10-14T00:00:00.000Z'), $lt: new Date('2026-10-15T00:00:00.000Z') },
    })
    expect(options).toMatchObject({
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      limit: 5,
      offset: 5,
    })
  })

  it('from/to 为含首尾的 UTC 日范围，与 date 同时出现时取交集', async () => {
    const { service, em } = setup()
    await service.findMany(query({ from: '2026-09-01', to: '2026-09-30' }))
    expect(em.findAndCount.mock.calls[0]![1].createdAt).toEqual({
      $gte: new Date('2026-09-01T00:00:00.000Z'),
      $lt: new Date('2026-10-01T00:00:00.000Z'),
    })
    await service.findMany(query({ from: '2026-09-01', date: '2026-09-15' }))
    expect(em.findAndCount.mock.calls[1]![1].createdAt).toEqual({
      $gte: new Date('2026-09-15T00:00:00.000Z'),
      $lt: new Date('2026-09-16T00:00:00.000Z'),
    })
    await service.findMany(query({ to: '2026-09-30' }))
    expect(em.findAndCount.mock.calls[2]![1].createdAt).toEqual({ $lt: new Date('2026-10-01T00:00:00.000Z') })
  })

  it('搜索与标签、类型、日期组合，关键词转义通配符，排序与列表一致', async () => {
    const { service, em } = setup()
    await service.search(searchQuery({ q: '100%_好', tag: '生活', type: 'memo', date: '2026-10-14' }))
    const [, where, options] = em.findAndCount.mock.calls[0]!
    const [base, matched] = where.$and
    expect(base).toMatchObject({ tags: { $contains: ['生活'] }, type: 'memo', isDraft: false, isArchived: false })
    expect(base.createdAt.$gte).toEqual(new Date('2026-10-14T00:00:00.000Z'))
    expect(matched.$or[0]).toEqual({ content: { $ilike: '%100\\%\\_好%' } })
    // 第二个条件是标签包含关键词（不区分大小写）的原生片段
    expect(Object.keys(matched.$or[1])).toHaveLength(1)
    expect(options.orderBy).toEqual([{ isPinned: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }])
  })

  it('拒绝读取归档与其他用户', async () => {
    const { service } = setup()
    await expect(service.findMany(query({ archived: 'true' }))).rejects.toMatchObject({ status: 400 })
    await expect(service.search(searchQuery({ q: 'a', userId: 'other' }))).rejects.toMatchObject({ status: 400 })
  })

  it('参数校验：类型限定枚举，日期须为真实存在的 YYYY-MM-DD', () => {
    expect(validateSync(query({ type: 'idea', date: '2026-02-28', from: '2026-01-01', to: '2026-12-31' }))).toEqual([])
    expect(validateSync(query({ type: 'note' }))).toHaveLength(1)
    expect(validateSync(query({ date: '2026-02-30' }))).toHaveLength(1)
    expect(validateSync(query({ from: '2026/01/01' }))).toHaveLength(1)
    expect(validateSync(query({ to: '2026-10-14T00:00:00Z' }))).toHaveLength(1)
  })
})

describe('FlashService 公开概览', () => {
  const now = new Date('2026-10-18T03:00:00.000Z')
  function withRows(em: ReturnType<typeof setup>['em'], liked: { id: string }[] = []) {
    em.connection.execute
      .mockResolvedValueOnce([{ total: 21, monthCount: 11 }])
      .mockResolvedValueOnce([
        { date: '2026-10-16', count: 1 },
        { date: '2026-10-15', count: 2 },
      ])
      .mockResolvedValueOnce([{ name: '生活', count: 11 }])
      .mockResolvedValueOnce([{ id: 'old', content: '去年今日', created_at: new Date('2025-10-18T09:00:00.000Z') }])
      .mockResolvedValueOnce([{ id: 'r1', content: '回顾', created_at: '2026-10-01T00:00:00.000Z' }])
      .mockResolvedValueOnce(liked)
  }

  it('聚合结果映射为契约形状，本月与往年今日按 UTC 计算，未带访客头不查点赞', async () => {
    const { service, em } = setup()
    withRows(em)
    const result = await service.overview('', now)
    expect(result).toEqual({
      total: 21,
      monthCount: 11,
      dates: [
        { date: '2026-10-16', count: 1 },
        { date: '2026-10-15', count: 2 },
      ],
      tags: [{ name: '生活', count: 11 }],
      onThisDay: { id: 'old', content: '去年今日', createdAt: '2025-10-18T09:00:00.000Z' },
      recollections: [{ id: 'r1', content: '回顾', createdAt: '2026-10-01T00:00:00.000Z' }],
      likedIds: [],
    })
    const calls = em.connection.execute.mock.calls as [string, unknown[]][]
    expect(calls).toHaveLength(5)
    // 只读聚合：不加载实体、不写库
    expect(em.find).not.toHaveBeenCalled()
    expect(em.findAndCount).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
    expect(calls.every(([sql]) => /^\s*select/i.test(sql))).toBe(true)
    expect(calls.every(([sql]) => sql.includes('is_draft = false and is_archived = false'))).toBe(true)
    expect(calls[0]![1]).toEqual([new Date('2026-10-01T00:00:00.000Z'), new Date('2026-11-01T00:00:00.000Z'), 'tixxin'])
    expect(calls[1]![0]).toContain("at time zone 'UTC'")
    expect(calls[3]![1]).toEqual(['tixxin', '10-18', new Date('2026-01-01T00:00:00.000Z')])
  })

  it('携带访客时只返回该访客对公开闪念的点赞编号', async () => {
    const { service, em } = setup()
    withRows(em, [{ id: 'a1' }, { id: 'a2' }])
    const result = await service.overview(visitor, now)
    expect(result.likedIds).toEqual(['a1', 'a2'])
    const [sql, params] = em.connection.execute.mock.calls[5] as [string, unknown[]]
    expect(sql).toContain('flash_like')
    expect(sql).toContain('n.is_draft = false and n.is_archived = false')
    expect(params).toEqual([visitor, 'tixxin'])
  })

  it('没有公开闪念时返回零值与空集合', async () => {
    const { service } = setup()
    expect(await service.overview('', now)).toEqual({
      total: 0,
      monthCount: 0,
      dates: [],
      tags: [],
      onThisDay: null,
      recollections: [],
      likedIds: [],
    })
  })
})
