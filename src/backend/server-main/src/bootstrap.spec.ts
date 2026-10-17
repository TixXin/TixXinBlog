/**
 * @file bootstrap.spec.ts
 * @description 共用 HTTP 配置回归：隐藏框架指纹、X-Request-Id 与响应 traceId 一致、启动失败退出
 */
import { Controller, Get, Logger, Module } from '@nestjs/common'
import type { INestApplication } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { configureApplication, reportBootstrapFailure } from './bootstrap'
import { ReadinessState } from './modules/health/readiness-state'

@Controller('probe')
class ProbeController {
  @Get()
  ok() {
    return { ok: true }
  }
  @Get('fail')
  fail() {
    throw new Error('internal detail')
  }
}

@Module({
  imports: [ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true })],
  controllers: [ProbeController],
  providers: [ReadinessState],
})
class ProbeModule {}

describe('configureApplication', () => {
  let app: INestApplication
  let origin: string
  beforeAll(async () => {
    app = await NestFactory.create(ProbeModule, { logger: false })
    configureApplication(app)
    await app.listen(0, '127.0.0.1')
    origin = await app.getUrl()
  })
  afterAll(async () => {
    await app.close()
  })

  it('不返回 X-Powered-By，X-Request-Id 与响应 traceId 一致', async () => {
    const response = await fetch(`${origin}/api/v1/probe`)
    const body = (await response.json()) as { traceId: string }
    expect(response.headers.get('x-powered-by')).toBeNull()
    expect(response.headers.get('x-request-id')).toBe(body.traceId)
    expect(body.traceId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('上游合法 traceId 透传，非法值重新生成；500 同样带一致编号且不泄露细节', async () => {
    const accepted = await fetch(`${origin}/api/v1/probe`, { headers: { 'x-trace-id': 'edge-1' } })
    expect(accepted.headers.get('x-request-id')).toBe('edge-1')
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    try {
      const failed = await fetch(`${origin}/api/v1/probe/fail`, { headers: { 'x-trace-id': 'bad trace!' } })
      const body = (await failed.json()) as { traceId: string; message: string }
      expect(failed.status).toBe(500)
      expect(body.traceId).toMatch(/^[0-9a-f-]{36}$/)
      expect(failed.headers.get('x-request-id')).toBe(body.traceId)
      expect(JSON.stringify(body)).not.toContain('internal detail')
      expect(error).toHaveBeenCalledWith(expect.objectContaining({ traceId: body.traceId }), expect.any(String))
    } finally {
      error.mockRestore()
    }
  })
})

describe('reportBootstrapFailure', () => {
  it('记录堆栈后以 1 退出', () => {
    const exit = jest.fn()
    const logger = { error: jest.fn() } as unknown as Logger
    reportBootstrapFailure(new Error('listen EADDRINUSE'), exit, logger)
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('listen EADDRINUSE'))
    expect(exit).toHaveBeenCalledWith(1)
  })
})
