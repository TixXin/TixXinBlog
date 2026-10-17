/** @file post-discovery.service.spec.ts @description 轻量统计不执行全量归档读取，完整模式保持旧响应并附内容修订时间 */
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
})
