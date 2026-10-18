/** @file client-error.controller.spec.ts @description 无数据库的独立 HTTP 回归：公开契约、脱敏日志与限流。 */
import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import type { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { configureApplication } from '../../bootstrap'
import { RateLimitGuard } from '../../common/guards/rate-limit.guard'
import { auditDescriptor } from '../audit/audit-description'
import { ClientErrorModule } from './client-error.module'

const valid = { source: 'vue', message: '组件渲染失败', url: 'https://blog.example.com/posts/hello' }

describe('客户端错误公开 HTTP 入口', () => {
  let app: INestApplication
  let origin: string
  let warn: jest.SpyInstance

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [ClientErrorModule],
      providers: [
        { provide: ConfigService, useValue: new ConfigService({ NODE_ENV: 'production' }) },
        { provide: APP_GUARD, useClass: RateLimitGuard },
      ],
    }).compile()
    app = module.createNestApplication({ logger: false })
    configureApplication(app)
    await app.listen(0, '127.0.0.1')
    origin = await app.getUrl()
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
  })

  afterEach(async () => {
    warn.mockRestore()
    await app.close()
  })

  const post = (origin: string, body: unknown, path = '/api/v1/client-errors') =>
    fetch(`${origin}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-trace-id': 'client-error-test' },
      body: JSON.stringify(body),
    })

  it('无需认证或内容上下文，返回 202 及标准响应，只输出一次脱敏结构化日志', async () => {
    const response = await post(origin, {
      source: 'vue',
      message: '请求 https://user:password@blog.example.com/api?token=secret#private 失败\u0000\r\n伪造行',
      url: 'https://user:password@blog.example.com/admin?token=secret#private',
      stack: 'Error: fail\n at /app.js?token=secret:1:2\n at //user:password@cdn.example.com/app.js#private',
      info: 'render /posts?token=secret',
    })
    expect(response.status).toBe(202)
    expect(await response.json()).toEqual({
      code: 0,
      message: 'ok',
      data: { accepted: true },
      traceId: 'client-error-test',
    })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith({
      event: 'client_error',
      traceId: 'client-error-test',
      report: {
        source: 'vue',
        message: '请求 https://blog.example.com/api 失败   伪造行',
        url: 'https://blog.example.com/admin',
        stack: 'Error: fail  at /app.js  at //cdn.example.com/app.js',
        info: 'render /posts',
      },
    })
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/secret|password|token|private/)
    // 入口不在审计写入表中；独立模块无需任何 ORM 或数据库服务即可运行。
    expect(auditDescriptor('/api/v1/client-errors', 'POST')).toBeNull()
  })

  it('字段错误返回 400，非法上报不会记录错误正文', async () => {
    const response = await post(origin, { ...valid, extra: 'unknown' })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ data: null, traceId: 'client-error-test' })
    expect(warn).not.toHaveBeenCalled()
  })

  it('大小写、尾斜线和伪造访客 ID 均共享五次配额，超限返回 429 与 Retry-After', async () => {
    for (const path of [
      '/api/v1/client-errors',
      '/api/v1/client-errors/',
      '/API/V1/CLIENT-ERRORS',
      '/api/v1/Client-Errors/',
      '/api/v1/client-errors?ignored=1',
    ]) {
      expect((await post(origin, valid, path)).status).toBe(202)
    }
    const rejected = await fetch(`${origin}/api/v1/client-errors/`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-visitor-id': 'rotated-visitor',
        'x-forwarded-for': '192.0.2.99',
      },
      body: JSON.stringify(valid),
    })
    expect(rejected.status).toBe(429)
    expect(Number(rejected.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(warn).toHaveBeenCalledTimes(5)
  })
})
