/** @file health.controller.spec.ts @description 开发归属探针、健康存活与就绪检查的委托与异常边界 */
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import type { Request } from 'express'
import { HealthController } from './health.controller'
import { HealthService } from './health.service'
import { ReadinessState } from './readiness-state'

describe('开发服务归属探针', () => {
  const original = { ...process.env }
  const healthService = { checkDatabase: jest.fn() } as unknown as HealthService
  const readiness = new ReadinessState()
  const controller = new HealthController(healthService, readiness)
  const request = (address: string) => ({ socket: { remoteAddress: address } }) as Request
  afterEach(() => {
    process.env = { ...original }
  })

  it.each(['production', 'test'])('%s 不提供开发探针', (mode) => {
    process.env.NODE_ENV = mode
    expect(() => controller.identity(request('127.0.0.1'))).toThrow(NotFoundException)
  })
  it('非本机请求不提供探针', () => {
    process.env.NODE_ENV = 'development'
    expect(() => controller.identity(request('192.0.2.1'))).toThrow(NotFoundException)
  })
  it('本机开发探针不暴露路径或数据库凭据', () => {
    process.env.NODE_ENV = 'development'
    process.env.DATABASE_URL = 'postgres://tester:secret-password@127.0.0.1:15433/sample'
    const value = controller.identity(request('127.0.0.1'))
    expect(value.service).toBe('server-main')
    expect(value.workspace).toMatch(/^[a-f0-9]{64}$/)
    expect(value.database).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(value)).not.toMatch(/secret-password|tester|sample/)
    expect(JSON.stringify(value)).not.toContain(process.cwd())
  })
})

describe('存活与就绪探针', () => {
  it('存活探针返回 ok 与正常运行秒数', () => {
    const healthService = { checkDatabase: jest.fn() } as unknown as HealthService
    const readiness = new ReadinessState()
    const controller = new HealthController(healthService, readiness)
    const result = controller.health()
    expect(result.status).toBe('ok')
    expect(typeof result.uptimeSeconds).toBe('number')
    expect(typeof result.timestamp).toBe('string')
  })

  it('正在关闭时就绪探针返回 503 且不请求数据库', async () => {
    const checkDatabase = jest.fn()
    const readiness = new ReadinessState()
    readiness.markShuttingDown()
    const controller = new HealthController({ checkDatabase } as unknown as HealthService, readiness)
    await expect(controller.ready()).rejects.toThrow(ServiceUnavailableException)
    expect(checkDatabase).not.toHaveBeenCalled()
  })

  it('数据库就绪时返回健康状态', async () => {
    const checkDatabase = jest.fn().mockResolvedValue(undefined)
    const readiness = new ReadinessState()
    const controller = new HealthController({ checkDatabase } as unknown as HealthService, readiness)
    const result = await controller.ready()
    expect(result.status).toBe('ok')
    expect(checkDatabase).toHaveBeenCalled()
  })

  it('数据库检查失败时返回 503', async () => {
    const checkDatabase = jest.fn().mockRejectedValue(new Error('db down'))
    const readiness = new ReadinessState()
    const controller = new HealthController({ checkDatabase } as unknown as HealthService, readiness)
    await expect(controller.ready()).rejects.toThrow(ServiceUnavailableException)
    expect(checkDatabase).toHaveBeenCalled()
  })
})
