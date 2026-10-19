/**
 * @file bootstrap.ts
 * @description 服务与端到端测试共用 HTTP 配置，确保测试覆盖真实校验和响应契约
 */
import { Logger, ValidationPipe } from '@nestjs/common'
import type { INestApplication } from '@nestjs/common'
import type { Request, Response, NextFunction } from 'express'
import type { NestExpressApplication } from '@nestjs/platform-express'
import cookieParser from 'cookie-parser'
import { ConfigService } from '@nestjs/config'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { ResponseWrapInterceptor } from './common/interceptors/response-wrap.interceptor'
import { parseTrustedProxyCidrs } from './common/utils/trusted-proxy'
import { getTraceId } from './common/utils/trace-id'
import { ReadinessState } from './modules/health/readiness-state'

export function configureApplication(app: INestApplication): void {
  const trustedProxies = parseTrustedProxyCidrs(app.get(ConfigService).get<string>('TRUSTED_PROXY_CIDRS'))
  ;(app as NestExpressApplication).set('trust proxy', trustedProxies.length ? trustedProxies : false)
  // 不对外暴露框架指纹。
  ;(app as NestExpressApplication).disable('x-powered-by')
  // 容纳 20 万字正文的 UTF-8 JSON，字段上限仍由 DTO 约束。
  ;(app as NestExpressApplication).useBodyParser('json', { limit: '1mb' })
  app.use((request: Request, response: Response, next: NextFunction) => {
    response.setHeader('X-Request-Id', getTraceId(request))
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Cache-Control', 'no-store')
    // 预览凭据、私有正文与初始化令牌在鉴权、限流或参数失败时也不能被缓存、索引或随来源头外传。
    if (
      /^\/api\/v1\/posts\/preview\/?$/i.test(request.path) ||
      /^\/api\/v1\/setup(?:\/|$)/i.test(request.path) ||
      /^\/api\/v1\/admin\/posts\/[^/]+\/preview-link\/?$/i.test(request.path)
    ) {
      response.setHeader('Cache-Control', 'private, no-store')
      response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
      response.setHeader('Referrer-Policy', 'no-referrer')
    }
    next()
  })
  app.use(cookieParser())
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready'] })
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  app.useGlobalFilters(new AllExceptionsFilter())
  app.useGlobalInterceptors(new ResponseWrapInterceptor())
  const corsOrigin = process.env.CORS_ORIGIN
  if (corsOrigin) app.enableCors({ origin: corsOrigin.split(',').map((origin) => origin.trim()), credentials: true })
  // 先于 Nest 的关闭钩子注册：收到信号立即让 /ready 返回 503，再按原流程关闭。
  readinessState(app)?.watchSignals()
  app.enableShutdownHooks()
}

/** 只装配部分模块的测试应用没有健康模块，此时不注册就绪标记。 */
function readinessState(app: INestApplication): ReadinessState | undefined {
  try {
    return app.get(ReadinessState, { strict: false })
  } catch {
    return undefined
  }
}

/** 启动失败：记录带堆栈的错误后以非零码退出，避免进程挂起或静默失败。 */
export function reportBootstrapFailure(
  error: unknown,
  exit: (code: number) => void = (code) => process.exit(code),
  logger = new Logger('Bootstrap'),
): void {
  Logger.flush()
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error)
  logger.error(`服务启动失败：${detail}`)
  exit(1)
}
