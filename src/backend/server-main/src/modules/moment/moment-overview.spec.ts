/** @file moment-overview.spec.ts @description 朋友圈概览的公开聚合、最小投影、身份映射隔离与 UTC 纪念日边界 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { Moment } from '../../entities/moment.entity'
import { MomentReadService } from './moment-read.service'

type PhotoProjection = Pick<Moment, 'id' | 'images'>
type RecollectionProjection = Pick<Moment, 'id' | 'content' | 'publishedAt' | 'createdAt'>

function recollection(id: string, overrides: Partial<RecollectionProjection> = {}): RecollectionProjection {
  return {
    id,
    content: '海边散步时，听见风穿过树叶。',
    publishedAt: new Date('2026-08-02T10:30:00.000Z'),
    createdAt: new Date('2026-08-01T12:00:00.000Z'),
    ...overrides,
  }
}

function setup() {
  const stats = { totalMoments: 0, totalLikes: 0, totalComments: 0 }
  const execute = jest.fn().mockResolvedValueOnce([stats]).mockResolvedValueOnce([]).mockResolvedValueOnce([])
  const photoEm = { find: jest.fn().mockResolvedValue([]) }
  const recentEm = { find: jest.fn().mockResolvedValue([]) }
  const anniversaryEm = { findOne: jest.fn().mockResolvedValue(null) }
  const em = {
    getConnection: jest.fn().mockReturnValue({ execute }),
    fork: jest.fn().mockReturnValueOnce(photoEm).mockReturnValueOnce(recentEm).mockReturnValueOnce(anniversaryEm),
    find: jest.fn(),
    findOne: jest.fn(),
  }
  return {
    service: new MomentReadService(em as unknown as EntityManager),
    em,
    execute,
    photoEm,
    recentEm,
    anniversaryEm,
  }
}

describe('朋友圈公开概览', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-10-18T23:45:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('统计只计公开且未删除的动态、点赞及公开评论', async () => {
    const { service, execute } = setup()

    await service.overview()

    expect(execute).toHaveBeenCalledTimes(3)
    const sql = String(execute.mock.calls[0][0]).replace(/\s+/g, ' ').trim()
    expect(sql).toContain('count(*)::int as "totalMoments"')
    expect(sql).toContain('coalesce(sum(likes),0)::int as "totalLikes"')
    expect(sql).toContain('from moment_comment c join moment m on m.id=c.moment_id')
    expect(sql).toContain(
      "where m.status='published' and m.deleted_at is null and c.status='published' and c.deleted_at is null",
    )
    expect(sql).toMatch(/as "totalComments" from moment where status='published' and deleted_at is null$/)
  })

  it('话题聚合按次数和名称稳定排序，UTC 日期保留全部历史且按日期倒序', async () => {
    const { service, execute } = setup()
    const stats = { totalMoments: 28, totalLikes: 97, totalComments: 43 }
    const topics = [
      { name: '散步', count: 5 },
      { name: '摄影', count: 3 },
    ]
    const dates = [
      { date: '2026-10-18', count: 2 },
      { date: '2018-01-02', count: 1 },
    ]
    execute.mockReset().mockResolvedValueOnce([stats]).mockResolvedValueOnce(topics).mockResolvedValueOnce(dates)

    expect(await service.overview()).toEqual({ stats, topics, dates, photos: [], recollections: [] })

    const topicSql = String(execute.mock.calls[1][0]).replace(/\s+/g, ' ').trim()
    expect(topicSql).toContain('jsonb_array_elements_text(topics) topic')
    expect(topicSql).toContain(
      "where status='published' and deleted_at is null group by topic order by count desc,topic asc",
    )
    const dateSql = String(execute.mock.calls[2][0]).replace(/\s+/g, ' ').trim()
    expect(dateSql).toContain("to_char(published_at at time zone 'UTC','YYYY-MM-DD') as date")
    expect(dateSql).toContain("where status='published' and deleted_at is null group by date order by date desc")
    expect(dateSql).not.toMatch(/\blimit\b|\boffset\b|\bcurrent_date\b|\binterval\b|published_at\s*[<>]/i)
  })

  it('照片只读取非空图片动态的编号和图片，最多九条并按热度、日期、编号排序', async () => {
    const { service, photoEm } = setup()
    const photos: PhotoProjection[] = [
      { id: 'sunrise', images: ['/media/sunrise.webp', '/media/sea.webp'] },
      { id: 'forest', images: ['https://images.example.com/forest.webp'] },
    ]
    photoEm.find.mockResolvedValue(photos)

    const result = await service.overview()

    expect(result.photos).toEqual([
      { src: '/media/sunrise.webp', momentId: 'sunrise' },
      { src: 'https://images.example.com/forest.webp', momentId: 'forest' },
    ])
    expect(photoEm.find).toHaveBeenCalledTimes(1)
    const [entity, where, options] = photoEm.find.mock.calls[0]
    expect(entity).toBe(Moment)
    expect(where).toEqual({
      status: 'published',
      deletedAt: null,
      [Object.keys(where).find((key) => key.includes('jsonb_array_length('))!]: { $gt: 0 },
    })
    expect(Object.keys(where)).toEqual(
      expect.arrayContaining([expect.stringMatching(/jsonb_array_length\(.*\.images\)/)]),
    )
    expect(options).toEqual({
      fields: ['id', 'images'],
      orderBy: { likes: 'desc', publishedAt: 'desc', id: 'desc' },
      limit: 9,
    })
  })

  it('照片与两类回顾各自使用独立 fork，同编号的部分实体不会污染请求级身份映射', async () => {
    const { service, em, photoEm, recentEm, anniversaryEm } = setup()
    const photo = Object.freeze({ id: 'shared', images: Object.freeze(['/media/shared.webp']) })
    const recent = Object.freeze(recollection('shared'))
    const anniversary = Object.freeze(recollection('anniversary', { publishedAt: new Date('2025-10-18T10:00:00Z') }))
    photoEm.find.mockResolvedValue([photo])
    recentEm.find.mockResolvedValue([recent])
    anniversaryEm.findOne.mockResolvedValue(anniversary)

    const result = await service.overview()

    expect(em.fork).toHaveBeenCalledTimes(3)
    expect(em.fork.mock.results.map((entry) => entry.value)).toEqual([photoEm, recentEm, anniversaryEm])
    expect(em.find).not.toHaveBeenCalled()
    expect(em.findOne).not.toHaveBeenCalled()
    expect(photo).toEqual({ id: 'shared', images: ['/media/shared.webp'] })
    expect(recent).not.toHaveProperty('images')
    expect(result.photos).toEqual([{ src: '/media/shared.webp', momentId: 'shared' }])
    expect(result.recollections.map((item) => item.id)).toEqual(['shared', 'anniversary'])
  })

  it('随机回顾只加载卡片字段并截取三百字，发布时间缺省时使用创建时间', async () => {
    const { service, recentEm } = setup()
    const fullText = '沿着海岸慢慢走。'.repeat(60)
    recentEm.find.mockResolvedValue([
      recollection('long', { content: fullText }),
      recollection('fallback', { content: '雨后出门', publishedAt: null }),
    ])

    const result = await service.overview()

    expect(result.recollections).toEqual([
      { id: 'long', content: fullText.slice(0, 300), date: '2026-08-02T10:30:00.000Z' },
      { id: 'fallback', content: '雨后出门', date: '2026-08-01T12:00:00.000Z' },
    ])
    const [entity, where, options] = recentEm.find.mock.calls[0]
    expect(entity).toBe(Moment)
    expect(where).toEqual({ status: 'published', deletedAt: null })
    expect(options).toEqual({
      fields: ['id', 'content', 'publishedAt', 'createdAt'],
      orderBy: { [Object.keys(options.orderBy)[0]!]: 'asc' },
      limit: 12,
    })
    expect(Object.keys(options.orderBy)).toEqual([expect.stringContaining('random()')])
  })

  it.each([
    ['2026-10-18T23:45:00.000Z', '2025-10-18T00:00:00.000Z', '2025-10-19T00:00:00.000Z'],
    ['2026-01-01T00:15:00.000Z', '2025-01-01T00:00:00.000Z', '2025-01-02T00:00:00.000Z'],
    ['2025-02-28T23:59:00.000Z', '2024-02-28T00:00:00.000Z', '2024-02-29T00:00:00.000Z'],
    ['2025-03-01T00:00:00.000Z', '2024-03-01T00:00:00.000Z', '2024-03-02T00:00:00.000Z'],
  ])('在 %s 仅查去年同一 UTC 日的半开区间', async (now, from, to) => {
    jest.setSystemTime(new Date(now))
    const { service, anniversaryEm } = setup()

    await service.overview()

    expect(anniversaryEm.findOne).toHaveBeenCalledWith(
      Moment,
      { status: 'published', deletedAt: null, publishedAt: { $gte: new Date(from), $lt: new Date(to) } },
      { fields: ['id', 'content', 'publishedAt', 'createdAt'], orderBy: { publishedAt: 'desc', id: 'desc' } },
    )
  })

  it('随机回顾已有纪念日动态时按编号去重并保持原始顺序', async () => {
    const { service, recentEm, anniversaryEm } = setup()
    recentEm.find.mockResolvedValue([recollection('first'), recollection('same'), recollection('last')])
    anniversaryEm.findOne.mockResolvedValue(recollection('same'))

    const result = await service.overview()

    expect(result.recollections.map((item) => item.id)).toEqual(['first', 'same', 'last'])
  })

  it('纪念日不在十二条随机回顾中时追加为第十三条，并使用相同的最小投影', async () => {
    const { service, recentEm, anniversaryEm } = setup()
    const recent = Array.from({ length: 12 }, (_, index) => recollection(`recent-${index}`))
    const anniversary = recollection('anniversary', {
      content: '去年的山路。'.repeat(80),
      publishedAt: new Date('2025-10-18T07:00:00.000Z'),
    })
    recentEm.find.mockResolvedValue(recent)
    anniversaryEm.findOne.mockResolvedValue(anniversary)

    const result = await service.overview()

    expect(result.recollections).toHaveLength(13)
    expect(result.recollections.slice(0, 12).map((item) => item.id)).toEqual(
      Array.from({ length: 12 }, (_, index) => `recent-${index}`),
    )
    expect(result.recollections[12]).toEqual({
      id: 'anniversary',
      content: anniversary.content.slice(0, 300),
      date: '2025-10-18T07:00:00.000Z',
    })
  })

  it('闰日没有去年对应日期时不查询三月一日，也不创建纪念日 fork', async () => {
    jest.setSystemTime(new Date('2024-02-29T12:00:00.000Z'))
    const { service, em, recentEm, anniversaryEm } = setup()
    recentEm.find.mockResolvedValue([recollection('leap-day')])

    const result = await service.overview()

    expect(em.fork).toHaveBeenCalledTimes(2)
    expect(anniversaryEm.findOne).not.toHaveBeenCalled()
    expect(result.recollections.map((item) => item.id)).toEqual(['leap-day'])
  })

  it('没有公开数据时返回数据库零统计与空数组', async () => {
    const { service } = setup()

    expect(await service.overview()).toEqual({
      stats: { totalMoments: 0, totalLikes: 0, totalComments: 0 },
      topics: [],
      dates: [],
      photos: [],
      recollections: [],
    })
  })

  it.each(['统计', '话题', '日期', '照片', '随机回顾', '纪念日'] as const)(
    '%s 读取失败时原样抛出错误，不返回部分概览',
    async (branch) => {
      const { service, execute, photoEm, recentEm, anniversaryEm } = setup()
      const error = new Error(`${branch}不可用`)
      if (branch === '统计' || branch === '话题' || branch === '日期') {
        const failedQuery = { 统计: 0, 话题: 1, 日期: 2 }[branch]
        execute.mockReset().mockImplementation((_sql: string) => {
          const index = execute.mock.calls.length - 1
          if (index === failedQuery) return Promise.reject(error)
          return Promise.resolve(index === 0 ? [{ totalMoments: 0, totalLikes: 0, totalComments: 0 }] : [])
        })
      } else if (branch === '照片') photoEm.find.mockRejectedValue(error)
      else if (branch === '随机回顾') recentEm.find.mockRejectedValue(error)
      else anniversaryEm.findOne.mockRejectedValue(error)

      await expect(service.overview()).rejects.toBe(error)
    },
  )
})
