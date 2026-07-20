/**
 * @file health.controller.spec.ts
 * @description HealthController 单元测试
 * @author TixXin
 * @since 2026-07-20
 */

import { Test } from '@nestjs/testing'
import { HealthController } from '../health.controller'

describe('HealthController', () => {
  let controller: HealthController

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile()

    controller = moduleRef.get(HealthController)
  })

  it('health 返回 ok 与运行时长', () => {
    const result = controller.health()
    expect(result.status).toBe('ok')
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0)
    expect(new Date(result.timestamp).getTime()).not.toBeNaN()
  })

  it('ready 返回 ok', () => {
    expect(controller.ready().status).toBe('ok')
  })
})
