/** @file moment-read-search.spec.ts @description 朋友圈公开搜索的字面匹配、可见性、分页与空结果回归 */
import { RawQueryFragment } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import { plainToInstance } from 'class-transformer'
import { Moment } from '../../entities/moment.entity'
import { Post } from '../../entities/post.entity'
import { QueryMomentsDto } from './moment.dto'
import { MomentReadService } from './moment-read.service'

function createService(items: Moment[] = [], total = items.length) {
  const connection = { execute: jest.fn().mockResolvedValue([]) }
  const em = {
    findAndCount: jest.fn().mockResolvedValue([items, total]),
    find: jest.fn().mockResolvedValue([]),
    getConnection: jest.fn().mockReturnValue(connection),
  }
  return { service: new MomentReadService(em as unknown as EntityManager), em, connection }
}

function createMoment(id = 'moment-1') {
  return Object.assign(new Moment(), {
    id,
    content: '海边散步时记下的风景',
    topics: ['海边'],
    status: 'published' as const,
    publishedAt: new Date('2026-09-12T12:00:00.000Z'),
    createdAt: new Date('2026-09-12T11:00:00.000Z'),
    updatedAt: new Date('2026-09-12T11:00:00.000Z'),
  })
}

function expectPublicSearch(where: unknown, pattern: string, filters: Record<string, unknown> = {}) {
  const query = where as { $and: { $or: Record<string, unknown>[] }[] }
  const topicCondition = query.$and[0]!.$or[2]!
  const topicKey = Object.keys(topicCondition)[0]!
  // 消费 ORM 的原始表达式，既检查话题字段，也避免 mock 查询留下原始片段缓存。
  const topicFragment = RawQueryFragment.getKnownFragment(topicKey)
  expect(topicFragment?.sql).toMatch(/\.topics::text$/)
  expect(topicFragment?.params).toEqual([])
  expect(where).toEqual({
    $and: [
      {
        status: 'published',
        deletedAt: null,
        ...filters,
        $or: [{ content: { $ilike: pattern } }, { location: { $ilike: pattern } }, { [topicKey]: { $ilike: pattern } }],
      },
    ],
  })
}

describe('朋友圈公开搜索', () => {
  it.each([
    ['普通关键词', '海边', '%海边%'],
    ['百分号', '100%', '%100\\%%'],
    ['下划线', 'note_', '%note\\_%'],
    ['反斜杠', String.raw`路\径`, String.raw`%路\\径%`],
    ['连续特殊字符', String.raw`\%_`, String.raw`%\\\%\_%`],
  ])('%s 在正文、地点和话题中使用字面包含匹配，并限制公开且未删除动态', async (_name, q, pattern) => {
    const { service, em } = createService()

    await service.list(plainToInstance(QueryMomentsDto, { q }))

    expect(em.findAndCount).toHaveBeenCalledTimes(1)
    expect(em.findAndCount.mock.calls[0]![0]).toBe(Moment)
    expectPublicSearch(em.findAndCount.mock.calls[0]![1], pattern)
  })

  it('关键词与精确话题、UTC 日期筛选共同约束列表和总数', async () => {
    const { service, em } = createService()

    await service.list(
      plainToInstance(QueryMomentsDto, { q: '海边', topic: '散步', date: '2026-09-12', page: 2, pageSize: 5 }),
    )

    expect(em.findAndCount).toHaveBeenCalledTimes(1)
    expectPublicSearch(em.findAndCount.mock.calls[0]![1], '%海边%', {
      topics: { $contains: ['散步'] },
      publishedAt: { $gte: new Date('2026-09-12T00:00:00.000Z'), $lt: new Date('2026-09-13T00:00:00.000Z') },
    })
    expect(em.findAndCount.mock.calls[0]![2]).toEqual(expect.objectContaining({ limit: 5, offset: 5 }))
  })

  it.each([
    ['默认置顶优先', undefined, { isPinned: 'desc', publishedAt: 'desc', createdAt: 'desc', id: 'desc' }],
    ['显式纯时间排序', false, { publishedAt: 'desc', createdAt: 'desc', id: 'desc' }],
  ])('%s 保持稳定排序、分页位置和真实总数', async (_name, pinnedFirst, orderBy) => {
    const items = [createMoment('moment-2'), createMoment('moment-1')]
    const { service, em, connection } = createService(items, 7)
    const query = plainToInstance(QueryMomentsDto, {
      q: '海边',
      page: 2,
      pageSize: 2,
      ...(pinnedFirst === undefined ? {} : { pinnedFirst }),
    })

    const result = await service.list(query)

    expectPublicSearch(em.findAndCount.mock.calls[0]![1], '%海边%')
    expect(em.findAndCount.mock.calls[0]![2]).toEqual({
      populate: ['linkedArticle'],
      fields: [
        '*',
        'linkedArticle.id',
        'linkedArticle.slug',
        'linkedArticle.title',
        'linkedArticle.summary',
        'linkedArticle.cover',
        'linkedArticle.status',
        'linkedArticle.deletedAt',
      ],
      orderBy,
      limit: 2,
      offset: 2,
    })
    expect(result).toEqual({
      items: [
        expect.objectContaining({ id: 'moment-2', content: items[0]!.content, date: '2026-09-12T12:00:00.000Z' }),
        expect.objectContaining({ id: 'moment-1', content: items[1]!.content, date: '2026-09-12T12:00:00.000Z' }),
      ],
      total: 7,
      page: 2,
      pageSize: 2,
    })
    expect(connection.execute).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['没有匹配记录', 1, 0, 0],
    ['超出末页', 4, 23, 30],
  ])('%s 返回空条目并保留分页总数，不查询无关互动信息', async (_name, page, total, offset) => {
    const { service, em, connection } = createService([], total)

    await expect(service.list(plainToInstance(QueryMomentsDto, { q: '海边', page, pageSize: 10 }))).resolves.toEqual({
      items: [],
      total,
      page,
      pageSize: 10,
    })

    expectPublicSearch(em.findAndCount.mock.calls[0]![1], '%海边%')
    expect(em.findAndCount.mock.calls[0]![2]).toEqual(expect.objectContaining({ limit: 10, offset }))
    expect(em.getConnection).not.toHaveBeenCalled()
    expect(connection.execute).not.toHaveBeenCalled()
    expect(em.find).not.toHaveBeenCalled()
  })

  it.each([undefined, '', '   '])('关键词 %j 经 DTO 规范化后不增加空搜索条件', async (q) => {
    const { service, em } = createService()

    await service.list(plainToInstance(QueryMomentsDto, { q }))

    expect(em.findAndCount).toHaveBeenCalledWith(
      Moment,
      { $and: [{ status: 'published', deletedAt: null }] },
      expect.objectContaining({ limit: 15, offset: 0 }),
    )
  })

  it.each([
    ['草稿', 'draft' as const, null],
    ['归档', 'archived' as const, null],
    ['已删除', 'published' as const, new Date('2026-09-13T00:00:00.000Z')],
  ])('公开搜索结果隐藏%s文章引用及管理字段', async (_name, status, deletedAt) => {
    const moment = createMoment()
    moment.linkedArticle = Object.assign(new Post(), { id: 7, title: '私有文章', status, deletedAt })
    const { service, em } = createService([moment])

    const result = await service.list(plainToInstance(QueryMomentsDto, { q: '海边' }))

    expectPublicSearch(em.findAndCount.mock.calls[0]![1], '%海边%')
    expect(result.items[0]).toEqual(expect.objectContaining({ id: moment.id, linkedArticle: null }))
    expect(result.items[0]).not.toHaveProperty('status')
    expect(result.items[0]).not.toHaveProperty('revision')
    expect(result.items[0]).not.toHaveProperty('linkedArticleId')
  })

  it('查询失败向调用方透传错误，不伪造空列表或零总数', async () => {
    const { service, em } = createService()
    const error = new Error('朋友圈读取失败')
    em.findAndCount.mockRejectedValueOnce(error)

    await expect(service.list(new QueryMomentsDto())).rejects.toBe(error)

    expect(em.getConnection).not.toHaveBeenCalled()
    expect(em.find).not.toHaveBeenCalled()
  })
})
