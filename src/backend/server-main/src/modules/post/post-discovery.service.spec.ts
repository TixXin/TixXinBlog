/** @file post-discovery.service.spec.ts @description 文章发现统计与归档的公开过滤、聚合、年月过滤、稳定分页及日期边界 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { PostDiscoveryService } from './post-discovery.service'

const ARCHIVE_SQL = 'select p.id, p.slug, p.seo_noindex, p.title'

describe('文章统计读取范围', () => {
  it('侧栏轻量统计跳过归档SQL，同时保留真实总量', async () => {
    const execute = jest.fn(async (sql: string) => (sql.includes('sum(views)') ? [{ posts: 10000, views: 15 }] : []))
    const service = new PostDiscoveryService({ execute } as unknown as EntityManager)
    const summary = await service.metadata(false)
    expect(summary.stats.posts).toBe(10000)
    expect(summary).not.toHaveProperty('archive')
    expect(execute.mock.calls.some(([sql]) => sql.startsWith(ARCHIVE_SQL))).toBe(false)
  })

  it('无参调用继续返回完整归档、规范化日期与内容修订时间', async () => {
    const execute = jest.fn(async (sql: string) => {
      if (sql.startsWith(ARCHIVE_SQL))
        return [
          {
            id: 1,
            slug: 'spring',
            title: '春日记录',
            folder: '随笔',
            published_at: '2026-03-01T00:00:00Z',
            updated_at: '2026-03-02T08:00:00+00:00',
          },
        ]
      return sql.includes('sum(views)') ? [{ posts: 1, views: 15 }] : []
    })
    const service = new PostDiscoveryService({ execute } as unknown as EntityManager)
    const metadata = await service.metadata()
    expect(metadata.archive).toEqual([
      {
        id: 1,
        slug: 'spring',
        title: '春日记录',
        folder: '随笔',
        date: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-02T08:00:00.000Z',
      },
    ])
    // 修订时间取当前修订快照，而非随浏览、点赞变化的实体 updated_at
    const archiveSql = execute.mock.calls.find(([sql]) => sql.startsWith(ARCHIVE_SQL))?.[0] ?? ''
    expect(archiveSql).toContain('from post_revision r')
    expect(archiveSql).not.toContain('p.updated_at')
  })

  it('标签、分类与活动保持数据库聚合结果，标签总量按不同标签数量计算', async () => {
    const tags = [
      { label: '开发', slug: 'development', color: 'blue', count: 3 },
      { label: '随笔', slug: 'notes', color: 'green', count: 1 },
    ]
    const categories = [
      { name: '技术笔记', count: 3 },
      { name: '生活记录', count: 1 },
    ]
    const activity = [
      { date: '2026-03-01', articles: 1, comments: 2 },
      { date: '2026-03-02', articles: 0, comments: 0 },
    ]
    const execute = jest.fn(async (sql: string) => {
      if (sql.includes('from post_tag t')) return tags
      if (sql.includes('folder as name')) return categories
      if (sql.includes('sum(views)')) return [{ posts: 4, views: 42 }]
      if (sql.startsWith('select count(*)::int as count from comment')) return [{ count: 7 }]
      if (sql.includes('with days as')) return activity
      return []
    })
    const service = new PostDiscoveryService({ execute } as unknown as EntityManager)

    expect(await service.metadata(false)).toEqual({
      tags,
      categories,
      activity,
      stats: { posts: 4, views: 42, comments: 7, tags: 2, siteAgeDays: 0 },
    })
    const tagSql = execute.mock.calls.find(([sql]) => sql.includes('from post_tag t'))?.[0] ?? ''
    expect(tagSql).toContain('count(*)::int as count')
    expect(tagSql).toContain('join post_tag_map m on m.post_tag_id=t.id join post p on p.id=m.post_id')
    expect(tagSql).toContain('group by t.id order by count desc,t.label')
    const categorySql = execute.mock.calls.find(([sql]) => sql.includes('folder as name'))?.[0] ?? ''
    expect(categorySql).toContain('count(*)::int as count')
    expect(categorySql).toContain('group by folder order by count desc,folder')
  })

  it.each([true, false])('归档开关为 %s 时所有聚合只读取已发布且未回收文章', async (includeArchive) => {
    const execute = jest.fn(async (_sql: string) => [])
    const service = new PostDiscoveryService({ execute } as unknown as EntityManager)

    await service.metadata(includeArchive)

    expect(execute).toHaveBeenCalledTimes(includeArchive ? 7 : 6)
    for (const [sql] of execute.mock.calls) {
      expect(sql).toMatch(/\b(?:p\.)?status\s*=\s*'published'/)
      expect(sql).toMatch(/\b(?:p\.)?deleted_at is null/)
    }
    const activitySql = execute.mock.calls.find(([sql]) => sql.includes('with days as'))?.[0] ?? ''
    expect(activitySql).toContain("articles as (select (published_at at time zone 'UTC')::date")
    expect(activitySql).toContain("from post where status='published' and deleted_at is null")
    expect(activitySql).toContain("from comment c join post p on p.id=c.post_id where p.status='published'")
    expect(activitySql).toContain('p.deleted_at is null')
    if (includeArchive) {
      const archiveSql = execute.mock.calls.find(([sql]) => sql.startsWith(ARCHIVE_SQL))?.[0] ?? ''
      expect(archiveSql).toContain('order by p.published_at desc, p.id desc')
    }
  })

  it('评论总数与每日活动都要求自身、父评论和根评论通过审核', async () => {
    const execute = jest.fn(async (_sql: string) => [])
    const service = new PostDiscoveryService({ execute } as unknown as EntityManager)

    await service.metadata(false)

    const commentQueries = execute.mock.calls.filter(([sql]) => sql.includes('from comment c'))
    expect(commentQueries).toHaveLength(2)
    for (const [sql] of commentQueries) {
      expect(sql).toContain("c.status='published' and (c.parent_id is null or exists(")
      expect(sql).toContain("visible_parent.id=c.parent_id and visible_parent.status='published'")
      expect(sql).toContain('visible_parent.parent_id is null or exists(')
      expect(sql).toContain('visible_root.id=visible_parent.parent_id')
      expect(sql).toContain("visible_root.status='published' and visible_root.parent_id is null")
    }
  })

  it.each([true, false])('归档开关为 %s 且没有结果时返回零统计与空集合', async (includeArchive) => {
    const execute = jest.fn(async () => [])
    const service = new PostDiscoveryService({ execute } as unknown as EntityManager)

    expect(await service.metadata(includeArchive)).toEqual({
      tags: [],
      categories: [],
      activity: [],
      stats: { posts: 0, views: 0, comments: 0, tags: 0, siteAgeDays: 0 },
      ...(includeArchive ? { archive: [] } : {}),
    })
  })
})

describe('站点年龄边界', () => {
  afterEach(() => jest.restoreAllMocks())

  it.each([
    { name: '优先采用配置的上线日', launchedAt: '2026-03-01', firstPublished: '2026-01-01', expected: 9 },
    { name: '未配置时回退最早公开文章', launchedAt: null, firstPublished: '2026-03-08', expected: 2 },
    { name: '没有上线日和公开文章', launchedAt: null, firstPublished: null, expected: 0 },
    { name: '上线当天不足整日', launchedAt: '2026-03-10', firstPublished: null, expected: 0 },
    { name: '未来上线日不产生负数', launchedAt: '2026-03-11', firstPublished: null, expected: 0 },
    { name: '非法上线日不产生非数值', launchedAt: 'invalid-date', firstPublished: null, expected: 0 },
  ])('$name', async ({ launchedAt, firstPublished, expected }) => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-03-10T23:59:59Z'))
    const execute = jest.fn(async (sql: string) =>
      sql.includes('from site_settings s') ? [{ launched_at: launchedAt, first_published: firstPublished }] : [],
    )
    const service = new PostDiscoveryService({ execute } as unknown as EntityManager)

    expect((await service.metadata(false)).stats.siteAgeDays).toBe(expected)
  })
})

describe('文章按年分页归档', () => {
  it('按年份绑定筛选与分页偏移，保持条目顺序并统一日期为 UTC ISO', async () => {
    const years = [
      { year: 2026, count: 5 },
      { year: 2025, count: 3 },
    ]
    const execute = jest.fn().mockResolvedValue([
      {
        items: [
          {
            id: 9,
            slug: 'spring-walk',
            seo_noindex: true,
            title: '春日散步',
            folder: '随笔',
            published_at: '2026-03-01T08:00:00+08:00',
            updated_at: '2026-03-02T09:30:00+08:00',
          },
          {
            id: 8,
            slug: 'early-spring',
            seo_noindex: false,
            title: '初春笔记',
            folder: '技术',
            published_at: new Date('2026-03-01T00:00:00Z'),
            updated_at: new Date('2026-03-01T00:00:00Z'),
          },
        ],
        total: 5,
        years,
      },
    ])
    const service = new PostDiscoveryService({ execute } as unknown as EntityManager)

    expect(await service.archive({ year: 2026, page: 2, pageSize: 2 })).toEqual({
      items: [
        {
          id: 9,
          slug: 'spring-walk',
          seoNoindex: true,
          title: '春日散步',
          folder: '随笔',
          date: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-02T01:30:00.000Z',
        },
        {
          id: 8,
          slug: 'early-spring',
          seoNoindex: false,
          title: '初春笔记',
          folder: '技术',
          date: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
        },
      ],
      total: 5,
      page: 2,
      pageSize: 2,
      years,
    })
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledWith(expect.any(String), [2026, null, null, 2, 2])
  })

  it('未指定年份时以空值绑定筛选并从首页读取', async () => {
    const execute = jest.fn().mockResolvedValue([{ items: [], total: 0, years: [] }])
    const service = new PostDiscoveryService({ execute } as unknown as EntityManager)

    expect(await service.archive({ page: 1, pageSize: 50 })).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 50,
      years: [],
    })
    expect(execute).toHaveBeenCalledWith(expect.any(String), [null, null, null, 50, 0])
  })

  it('同一查询快照限定公开文章并对页面与年份使用稳定排序', async () => {
    const execute = jest.fn().mockResolvedValue([])
    const service = new PostDiscoveryService({ execute } as unknown as EntityManager)

    await service.archive({ year: 2025, page: 3, pageSize: 20 })

    expect(execute).toHaveBeenCalledTimes(1)
    const sql = (execute.mock.calls[0][0] as string).replace(/\s+/g, ' ').trim()
    expect(sql).toContain("from post p where p.status='published' and p.deleted_at is null")
    expect(sql).toContain("extract(year from p.published_at at time zone 'UTC')::int as year")
    expect(sql).toContain('selected as ( select public_posts.* from public_posts cross join period')
    expect(sql).toContain('where period.start_date is null or (')
    expect(sql).toContain('page_items as (select * from selected order by published_at desc,id desc limit ? offset ?)')
    expect(sql).toContain('jsonb_agg(to_jsonb(p) order by published_at desc,id desc) from page_items p')
    expect(sql).toContain('(select count(*)::int from selected) as total')
    expect(sql).toContain('year_counts as (select year,count(*)::int as count from public_posts group by year)')
    expect(sql).toContain('jsonb_agg(to_jsonb(y) order by year desc) from year_counts y')
    expect(sql).toContain('greatest(p.published_at, coalesce((select r.created_at from post_revision r')
    expect(sql).toContain('where r.post_id = p.id and r.revision = p.revision), p.published_at)) as updated_at')
    expect(sql).not.toContain('p.updated_at')
    expect(execute).toHaveBeenCalledWith(expect.any(String), [2025, null, null, 20, 40])
  })

  it.each([
    { name: '没有匹配年份', year: 2024, page: 1, total: 0 },
    { name: '页码超过匹配记录', year: 2026, page: 4, total: 5 },
  ])('$name时保留筛选总数和所有公开年份', async ({ year, page, total }) => {
    const years = [
      { year: 2026, count: 5 },
      { year: 2025, count: 3 },
    ]
    const execute = jest.fn().mockResolvedValue([{ items: [], total, years }])
    const service = new PostDiscoveryService({ execute } as unknown as EntityManager)

    expect(await service.archive({ year, page, pageSize: 2 })).toEqual({
      items: [],
      total,
      page,
      pageSize: 2,
      years,
    })
  })

  it('数据库未返回聚合行时使用空结果且保留请求页码', async () => {
    const execute = jest.fn().mockResolvedValue([])
    const service = new PostDiscoveryService({ execute } as unknown as EntityManager)

    expect(await service.archive({ page: 7, pageSize: 10 })).toEqual({
      items: [],
      total: 0,
      page: 7,
      pageSize: 10,
      years: [],
    })
  })
})

describe('文章归档年月范围', () => {
  it.each([
    { year: undefined, month: undefined, expected: [null, null, null] },
    { year: 2026, month: undefined, expected: [2026, null, null] },
    { year: 2026, month: 3, expected: [2026, 3, 3] },
    { year: 2026, month: 12, expected: [2026, 12, 12] },
    { year: 1, month: 1, expected: [1, 1, 1] },
    { year: 9999, month: 12, expected: [9999, 12, 12] },
  ])('参数化传入年 $year 月 $month 的范围和分页', async ({ year, month, expected }) => {
    const execute = jest.fn().mockResolvedValue([{ items: [], total: 0, years: [] }])
    const service = new PostDiscoveryService({ execute } as unknown as EntityManager)
    await service.archive({ year, month, page: 2, pageSize: 50 })

    expect(execute).toHaveBeenCalledTimes(1)
    const [sql, parameters] = execute.mock.calls[0] as [string, unknown[]]
    expect(parameters).toEqual([...expected, 50, 50])
    // 由数据库构造 UTC 左闭右开范围，避免本机时区及 JavaScript 对 1–99 年的特殊处理。
    expect(sql).toContain('make_date(?::int,coalesce(?::int,1),1)')
    expect(sql).toContain("case when ?::int is null then interval '1 year' else interval '1 month' end")
    expect(sql).toContain("published_at >= period.start_date::timestamp at time zone 'UTC'")
    expect(sql).toContain("published_at < (period.start_date + period.duration) at time zone 'UTC'")
    expect(sql).toContain('where period.start_date is null or')
    expect(sql).toContain("from post p where p.status='published' and p.deleted_at is null")
    expect(sql).toContain('page_items as (select * from selected order by published_at desc,id desc limit ? offset ?)')
    expect(sql).toContain('(select count(*)::int from selected) as total')
    expect(sql).toContain('year_counts as (select year,count(*)::int as count from public_posts group by year)')
  })

  it('当月响应保留完整年份计数、真实总数和规范化文章日期', async () => {
    const years = [
      { year: 2026, count: 80 },
      { year: 2025, count: 20 },
    ]
    const execute = jest.fn().mockResolvedValue([
      {
        items: [
          {
            id: 8,
            slug: 'spring',
            seo_noindex: false,
            title: '春日记录',
            folder: '随笔',
            published_at: '2026-03-31T23:30:00-00:00',
            updated_at: '2026-04-02T08:00:00+00:00',
          },
        ],
        total: 51,
        years,
      },
    ])
    const service = new PostDiscoveryService({ execute } as unknown as EntityManager)

    expect(await service.archive({ year: 2026, month: 3, page: 2, pageSize: 50 })).toEqual({
      items: [
        {
          id: 8,
          slug: 'spring',
          seoNoindex: false,
          title: '春日记录',
          folder: '随笔',
          date: '2026-03-31T23:30:00.000Z',
          updatedAt: '2026-04-02T08:00:00.000Z',
        },
      ],
      total: 51,
      page: 2,
      pageSize: 50,
      years,
    })
  })

  it('空月份或越界页保持空列表、真实筛选总数与全局年份', async () => {
    const years = [{ year: 2026, count: 80 }]
    const execute = jest.fn().mockResolvedValueOnce([{ items: [], total: 0, years }])
    execute.mockResolvedValueOnce([{ items: [], total: 51, years }])
    const service = new PostDiscoveryService({ execute } as unknown as EntityManager)

    expect(await service.archive({ year: 2026, month: 1, page: 1, pageSize: 50 })).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 50,
      years,
    })
    expect(await service.archive({ year: 2026, month: 3, page: 3, pageSize: 50 })).toEqual({
      items: [],
      total: 51,
      page: 3,
      pageSize: 50,
      years,
    })
  })
})
