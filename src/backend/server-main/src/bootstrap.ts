/**
 * @file bootstrap.ts
 * @description 服务与端到端测试共用 HTTP 配置，确保测试覆盖真实校验和响应契约
 */
import { ValidationPipe } from '@nestjs/common'
import type { INestApplication } from '@nestjs/common'
import type { Request, Response, NextFunction } from 'express'
import type { NestExpressApplication } from '@nestjs/platform-express'
import cookieParser from 'cookie-parser'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { ResponseWrapInterceptor } from './common/interceptors/response-wrap.interceptor'

export function configureApplication(app: INestApplication): void {
  // 容纳 20 万字正文的 UTF-8 JSON，字段上限仍由 DTO 约束。
  ;(app as NestExpressApplication).useBodyParser('json', { limit: '1mb' })
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Cache-Control', 'no-store')
    next()
  })
  app.use(cookieParser())
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready'] })
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  app.useGlobalFilters(new AllExceptionsFilter())
  app.useGlobalInterceptors(new ResponseWrapInterceptor())
  const corsOrigin = process.env.CORS_ORIGIN
  if (corsOrigin) app.enableCors({ origin: corsOrigin.split(',').map((origin) => origin.trim()), credentials: true })
  app.enableShutdownHooks()
}
