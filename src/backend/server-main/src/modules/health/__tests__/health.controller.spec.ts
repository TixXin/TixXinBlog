/**
 * @file health.controller.spec.ts
 * @description HealthController 单元测试
 * @author TixXin
 * @since 2026-07-20
 */

import { Test } from '@nestjs/testing'
import { HealthController } from '../health.controller'
import { HealthService } from '../health.service'
import { ReadinessState } from '../readiness-state'

describe('HealthController', () => {
  let controller: HealthController
  let readiness: ReadinessState
  const checkDatabase = jest.fn()

  beforeEach(async () => {
    checkDatabase.mockReset().mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [ReadinessState, { provide: HealthService, useValue: { checkDatabase } }],
    }).compile()

    controller = moduleRef.get(HealthController)
    readiness = moduleRef.get(ReadinessState)
  })

  it('health 返回 ok 与运行时长', () => {
    const result = controller.health()
    expect(result.status).toBe('ok')
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0)
    expect(new Date(result.timestamp).getTime()).not.toBeNaN()
  })

  it('ready 查询数据库后返回 ok', async () => {
    expect((await controller.ready()).status).toBe('ok')
    expect(checkDatabase).toHaveBeenCalled()
  })

  it('数据库不可用时返回 503', async () => {
    checkDatabase.mockRejectedValue(new Error('offline'))
    await expect(controller.ready()).rejects.toMatchObject({ status: 503 })
  })

  it('收到关闭信号后 ready 立即返回 503，不再查询数据库，health 仍存活', async () => {
    readiness.watchSignals(['SIGUSR2'])
    process.emit('SIGUSR2', 'SIGUSR2')
    await expect(controller.ready()).rejects.toMatchObject({ status: 503 })
    expect(checkDatabase).not.toHaveBeenCalled()
    expect(controller.health().status).toBe('ok')
  })

  it('模块销毁时标记关闭并移除本实例的信号监听', () => {
    const before = process.listenerCount('SIGUSR2')
    readiness.watchSignals(['SIGUSR2'])
    expect(process.listenerCount('SIGUSR2')).toBe(before + 1)
    readiness.onModuleDestroy()
    expect(readiness.isShuttingDown).toBe(true)
    expect(process.listenerCount('SIGUSR2')).toBe(before)
  })
})
