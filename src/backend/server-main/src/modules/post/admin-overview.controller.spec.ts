/** @file admin-overview.controller.spec.ts @description 工作台分区失败保持未知状态，不用虚假零值覆盖运营数据。 */
import { EntityManager } from '@mikro-orm/postgresql'
import { AdminOverviewController } from './admin-overview.controller'

describe('运营工作台分区读取', () => {
  function setup() {
    const execute = jest.fn()
    const em = { getConnection: () => ({ execute }) } as unknown as EntityManager
    return { execute, controller: new AdminOverviewController(em) }
  }
  it('统计失败仍返回最近编辑，且不泄露数据库异常细节', async () => {
    const { execute, controller } = setup()
    execute
      .mockRejectedValueOnce(new Error('sensitive database path'))
      .mockResolvedValueOnce([
        { domain: 'post', id: '1', title: '继续写作', status: 'draft', updatedAt: new Date('2026-09-11T00:00:00Z') },
      ])
    const result = await controller.overview()
    expect(result.counts).toBeNull()
    expect(result.unavailable).toEqual(['counts'])
    expect(result.recentContent?.[0]?.updatedAt).toBe('2026-09-11T00:00:00.000Z')
    expect(JSON.stringify(result)).not.toContain('sensitive')
  })
  it('最近编辑失败保留真实统计，全部失败时两个分区均不可用', async () => {
    const { execute, controller } = setup()
    execute.mockResolvedValueOnce([{ drafts: 3 }]).mockRejectedValueOnce(new Error('unavailable'))
    expect(await controller.overview()).toMatchObject({
      counts: { drafts: 3 },
      recentContent: null,
      unavailable: ['recentContent'],
    })
    execute.mockRejectedValue(new Error('unavailable'))
    expect(await controller.overview()).toMatchObject({
      counts: null,
      recentContent: null,
      unavailable: ['counts', 'recentContent'],
    })
  })
})
