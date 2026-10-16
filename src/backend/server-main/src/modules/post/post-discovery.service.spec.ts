/** @file post-discovery.service.spec.ts @description 轻量统计不执行全量归档读取，完整模式保持旧响应 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { PostDiscoveryService } from './post-discovery.service'

describe('文章统计读取范围', () => {
  it('侧栏轻量统计跳过归档SQL，同时保留真实总量', async () => {
    const execute = jest.fn(async (sql: string) => (sql.includes('sum(views)') ? [{ posts: 10000, views: 15 }] : []))
    const service = new PostDiscoveryService({ execute } as unknown as EntityManager)
    const summary = await service.metadata(false)
    expect(summary.stats.posts).toBe(10000)
    expect(summary).not.toHaveProperty('archive')
    expect(execute.mock.calls.some(([sql]) => sql.startsWith('select id, slug, seo_noindex, title'))).toBe(false)
  })

  it('无参调用继续返回完整归档及规范化日期', async () => {
    const execute = jest.fn(async (sql: string) => {
      if (sql.startsWith('select id, slug, seo_noindex, title'))
        return [{ id: 1, slug: 'spring', title: '春日记录', folder: '随笔', published_at: '2026-03-01T00:00:00Z' }]
      return sql.includes('sum(views)') ? [{ posts: 1, views: 15 }] : []
    })
    const service = new PostDiscoveryService({ execute } as unknown as EntityManager)
    const metadata = await service.metadata()
    expect(metadata.archive).toEqual([
      { id: 1, slug: 'spring', title: '春日记录', folder: '随笔', date: '2026-03-01T00:00:00.000Z' },
    ])
  })
})
