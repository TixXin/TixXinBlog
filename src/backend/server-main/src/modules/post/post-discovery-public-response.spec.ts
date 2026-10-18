/**
 * @file post-discovery-public-response.spec.ts
 * @description 文章公开发现接口白名单：统计、归档、前后篇与相关文章不包含管理状态和修订内部信息。
 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { Post } from '../../entities/post.entity'
import { QueryPostArchiveDto } from './dto/query-post-archive.dto'
import { PostDiscoveryService } from './post-discovery.service'

const archiveRow = {
  id: 7,
  slug: 'spring',
  seo_noindex: false,
  title: '春日记录',
  folder: '随笔',
  published_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-02T00:00:00Z',
  status: 'published',
  deleted_at: null,
  revision: 9,
  snapshot: { contentRaw: '未发布修订正文' },
  reason: '内部修订说明',
  visitorIdHash: 'private-visitor-hash',
  ip: '192.0.2.48',
  email: 'private@example.test',
}
const archiveItem = {
  id: 7,
  slug: 'spring',
  seoNoindex: false,
  title: '春日记录',
  folder: '随笔',
  date: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-02T00:00:00.000Z',
}

function json(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value))
}

describe('文章发现 GET 响应白名单', () => {
  it.each([true, false])('统计 includeArchive=%s 只包含公开聚合与归档投影', async (includeArchive) => {
    // 聚合原始结果以实际 SELECT 列为边界，不把数据库不会选出的敏感列虚构为返回值。
    const tags = [{ label: '生活', slug: 'life', color: 'green', count: 1 }]
    const categories = [{ name: '随笔', count: 1 }]
    const activity = [{ date: '2026-03-01', articles: 1, comments: 2 }]
    const execute = jest.fn(async (sql: string) => {
      if (sql.startsWith('select p.id, p.slug')) return [archiveRow]
      if (sql.startsWith('select t.label')) return tags
      if (sql.startsWith('select folder')) return categories
      if (sql.includes('sum(views)')) return [{ posts: 1, views: 12 }]
      if (sql.startsWith('select count(*)::int as count from comment')) return [{ count: 2 }]
      if (sql.includes('with days as')) return activity
      if (sql.includes('from site_settings')) return [{ launched_at: null, first_published: null }]
      throw new Error(`未声明的查询：${sql}`)
    })
    const service = new PostDiscoveryService({ execute } as unknown as EntityManager)
    expect(json(await service.metadata(includeArchive))).toStrictEqual({
      tags,
      categories,
      activity,
      stats: { posts: 1, views: 12, comments: 2, tags: 1, siteAgeDays: 0 },
      ...(includeArchive ? { archive: [archiveItem] } : {}),
    })
    for (const [sql] of execute.mock.calls) {
      expect(sql).toMatch(/(?:p\.)?status\s*=\s*'published'/)
      expect(sql).toMatch(/(?:p\.)?deleted_at is null/)
      if (sql.includes('from comment c')) {
        expect(sql).toContain("c.status='published'")
        expect(sql).toContain("visible_parent.status='published'")
        expect(sql).toContain("visible_root.status='published'")
      }
    }
    const queries = execute.mock.calls.map(([sql]) => sql)
    expect(queries).toContain(
      "select t.label,t.slug,t.color,count(*)::int as count from post_tag t join post_tag_map m on m.post_tag_id=t.id join post p on p.id=m.post_id where p.status='published' and p.deleted_at is null group by t.id order by count desc,t.label",
    )
    expect(queries.some((sql) => sql.startsWith('select p.id, p.slug'))).toBe(includeArchive)
  })

  it('分页归档只返回公开目录字段，内部 year、状态及修订不会进入 items', async () => {
    const execute = jest
      .fn()
      .mockResolvedValue([{ items: [{ ...archiveRow, year: 2026 }], total: 1, years: [{ year: 2026, count: 1 }] }])
    const service = new PostDiscoveryService({ execute } as unknown as EntityManager)
    expect(json(await service.archive({ ...new QueryPostArchiveDto(), year: 2026 }))).toStrictEqual({
      items: [archiveItem],
      total: 1,
      page: 1,
      pageSize: 50,
      years: [{ year: 2026, count: 1 }],
    })
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("from post p where p.status='published' and p.deleted_at is null"),
      [2026, 2026, 50, 0],
    )
    const sql = execute.mock.calls[0][0] as string
    expect(sql).toContain('select year,count(*)::int as count from public_posts group by year')
    expect(sql).toContain('select r.created_at from post_revision r')
    expect(sql).not.toContain('p.updated_at')
  })

  it('前后篇投影只返回导航字段，对当前文章及两侧目标均约束公开状态', async () => {
    const row = { ...archiveRow, publishedAt: new Date(archiveRow.published_at) }
    const findOne = jest.fn().mockResolvedValueOnce(row).mockResolvedValueOnce(row).mockResolvedValueOnce(row)
    const service = new PostDiscoveryService({ findOne } as unknown as EntityManager)
    const navigationItem = {
      id: '7',
      slug: 'spring',
      title: '春日记录',
      category: '随笔',
      date: '2026-03-01T00:00:00.000Z',
    }
    expect(json(await service.navigation(7))).toStrictEqual({ prev: navigationItem, next: navigationItem })
    expect(findOne).toHaveBeenCalledTimes(3)
    for (const [, where] of findOne.mock.calls) expect(where).toMatchObject({ status: 'published', deletedAt: null })
  })

  it('相关文章只返回导航卡片，候选查询排除草稿、归档及回收记录', async () => {
    const findOne = jest.fn().mockResolvedValue({ ...archiveRow })
    const execute = jest.fn().mockResolvedValue([archiveRow])
    const service = new PostDiscoveryService({ findOne, execute } as unknown as EntityManager)
    expect(json(await service.related(9))).toStrictEqual([
      { id: '7', slug: 'spring', title: '春日记录', category: '随笔', date: '2026-03-01T00:00:00.000Z' },
    ])
    expect(findOne).toHaveBeenCalledWith(
      Post,
      { id: 9, status: 'published', deletedAt: null },
      { fields: ['id', 'folder'] },
    )
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("where p.status='published' and p.deleted_at is null and p.id<>?"),
      [9, '随笔', 9],
    )
  })

  it.each(['navigation', 'related'] as const)('%s 对当前不可见文章返回不存在且不查询周边内容', async (entry) => {
    const findOne = jest.fn().mockResolvedValue(null)
    const execute = jest.fn()
    const service = new PostDiscoveryService({ findOne, execute } as unknown as EntityManager)
    await expect(service[entry](7)).rejects.toMatchObject({ message: '文章不存在' })
    expect(findOne).toHaveBeenCalledTimes(1)
    expect(execute).not.toHaveBeenCalled()
  })
})
