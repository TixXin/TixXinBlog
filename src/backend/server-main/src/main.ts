/**
 * @file main.ts
 * @description 应用入口：NestFactory 引导、全局前缀、校验管道、统一响应与异常处理
 * @author TixXin
 * @since 2026-07-20
 */

import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app.module'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { ResponseWrapInterceptor } from './common/interceptors/response-wrap.interceptor'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  app.useLogger(app.get(Logger))

  // 路由前缀统一 /api/v1；健康探针保持根路径供 K8s/负载均衡直接访问
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready'] })

  // 全局校验：拒绝未声明字段，自动做类型转换（见 docs/backend/development.md §5.4）
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  app.useGlobalFilters(new AllExceptionsFilter())
  app.useGlobalInterceptors(new ResponseWrapInterceptor())

  // CORS 白名单：逗号分隔多 origin（见 docs/backend/api.md §6）
  const corsOrigin = process.env.CORS_ORIGIN
  if (corsOrigin) {
    app.enableCors({ origin: corsOrigin.split(',').map((o) => o.trim()), credentials: true })
  }

  app.enableShutdownHooks()

  const port = Number(process.env.PORT ?? 3000)
  await app.listen(port)
}

void bootstrap()
