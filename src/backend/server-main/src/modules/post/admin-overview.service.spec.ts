/** @file admin-overview.service.spec.ts @description 工作台分区失败保持未知状态，不用虚假零值覆盖运营数据。 */
import { EntityManager } from '@mikro-orm/postgresql'
import { AdminOverviewService } from './admin-overview.service'

describe('运营工作台分区读取服务', () => {
  function setup() {
    const execute = jest.fn()
    const em = { getConnection: () => ({ execute }) } as unknown as EntityManager
    return { execute, service: new AdminOverviewService(em) }
  }
  it('统计失败仍返回最近编辑，且不泄露数据库异常细节', async () => {
    const { execute, service } = setup()
    execute
      .mockRejectedValueOnce(new Error('sensitive database path'))
      .mockResolvedValueOnce([
        { domain: 'post', id: '1', title: '继续写作', status: 'draft', updatedAt: new Date('2026-09-11T00:00:00Z') },
      ])
      .mockResolvedValueOnce([{ date: '2026-09-11', content: 1, interactions: 0 }])
    const result = await service.getOverview()
    expect(result.counts).toBeNull()
    expect(result.unavailable).toEqual(['counts'])
    expect(result.trends).toEqual([{ date: '2026-09-11', content: 1, interactions: 0 }])
    expect(result.recentContent?.[0]?.updatedAt).toBe('2026-09-11T00:00:00.000Z')
    expect(JSON.stringify(result)).not.toContain('sensitive')
  })
  it('最近编辑失败保留真实统计，全部失败时两个分区均不可用', async () => {
    const { execute, service } = setup()
    execute
      .mockResolvedValueOnce([{ drafts: 3 }])
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce([])
    expect(await service.getOverview()).toMatchObject({
      counts: { drafts: 3 },
      recentContent: null,
      trends: [],
      unavailable: ['recentContent'],
    })
    execute.mockRejectedValue(new Error('unavailable'))
    expect(await service.getOverview()).toMatchObject({
      counts: null,
      recentContent: null,
      trends: null,
      unavailable: ['counts', 'recentContent', 'trends'],
    })
  })
  it('趋势失败只标记趋势分区，统计与最近编辑照常返回', async () => {
    const { execute, service } = setup()
    execute
      .mockResolvedValueOnce([{ drafts: 1 }])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('unavailable'))
    expect(await service.getOverview()).toMatchObject({
      counts: { drafts: 1 },
      recentContent: [],
      trends: null,
      unavailable: ['trends'],
    })
  })
})
