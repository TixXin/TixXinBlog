/** @file health.controller.spec.ts @description 开发归属探针的环境、来源与信息边界 */
import { NotFoundException } from '@nestjs/common'
import type { Request } from 'express'
import type { EntityManager } from '@mikro-orm/postgresql'
import { HealthController } from './health.controller'

describe('开发服务归属探针', () => {
  const original = { ...process.env }
  const controller = new HealthController({} as EntityManager)
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
