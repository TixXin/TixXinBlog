/** @file admin-pending.spec.ts @description 导航待审数量：单条查询只含五个待审项，与工作台统计共用同一组子查询 */
import { EntityManager } from '@mikro-orm/postgresql'
import { AdminOverviewService } from './admin-overview.service'
import { PENDING_COUNT_SQL, PENDING_COUNTS_QUERY } from './admin-pending'

describe('后台导航待审数量', () => {
  it('一次查询返回五个待审项，不读取趋势与最近内容', async () => {
    const counts = {
      pendingComments: 2,
      pendingFlashComments: 0,
      pendingMomentComments: 1,
      pendingGuestbook: 3,
      pendingLinkApplications: 1,
    }
    const execute = jest.fn().mockResolvedValue([counts])
    const service = new AdminOverviewService({ getConnection: () => ({ execute }) } as unknown as EntityManager)
    expect(await service.pendingCounts()).toEqual(counts)
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledWith(PENDING_COUNTS_QUERY)
  })

  it('查询列出每个待审项且只统计待审状态', () => {
    for (const [key, sql] of Object.entries(PENDING_COUNT_SQL)) {
      expect(PENDING_COUNTS_QUERY).toContain(`as "${key}"`)
      expect(sql).toContain("status='pending'")
    }
    expect(Object.keys(PENDING_COUNT_SQL)).toHaveLength(5)
  })

  it('工作台统计复用同一组子查询', async () => {
    const execute = jest.fn().mockResolvedValue([])
    const service = new AdminOverviewService({ getConnection: () => ({ execute }) } as unknown as EntityManager)
    await service.getOverview()
    const countsSql = String(execute.mock.calls[0]![0])
    for (const key of ['pendingComments', 'pendingFlashComments', 'pendingMomentComments', 'pendingGuestbook'] as const)
      expect(countsSql).toContain(`${PENDING_COUNT_SQL[key]} as "${key}"`)
  })
})
