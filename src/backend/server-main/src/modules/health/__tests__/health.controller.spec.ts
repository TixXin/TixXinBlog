/**
 * @file health.controller.spec.ts
 * @description HealthController 单元测试
 * @author TixXin
 * @since 2026-07-20
 */

import { Test } from '@nestjs/testing'
import { HealthController } from '../health.controller'
import { EntityManager } from '@mikro-orm/postgresql'

describe('HealthController', () => {
  let controller: HealthController
  const execute = jest.fn()

  beforeEach(async () => {
    execute.mockReset().mockResolvedValue([{ '?column?': 1 }])
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: EntityManager, useValue: { getConnection: () => ({ execute }) } }],
    }).compile()

    controller = moduleRef.get(HealthController)
  })

  it('health 返回 ok 与运行时长', () => {
    const result = controller.health()
    expect(result.status).toBe('ok')
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0)
    expect(new Date(result.timestamp).getTime()).not.toBeNaN()
  })

  it('ready 查询数据库后返回 ok', async () => {
    expect((await controller.ready()).status).toBe('ok')
    expect(execute).toHaveBeenCalledWith('select 1')
  })

  it('数据库不可用时返回 503', async () => {
    execute.mockRejectedValue(new Error('offline'))
    await expect(controller.ready()).rejects.toMatchObject({ status: 503 })
  })
})
