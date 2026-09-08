/**
 * @file main.ts
 * @description 应用入口：NestFactory 引导、全局前缀、校验管道、统一响应与异常处理
 * @author TixXin
 * @since 2026-07-20
 */

import { NestFactory } from '@nestjs/core'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app.module'
import { configureApplication } from './bootstrap'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  app.useLogger(app.get(Logger))

  configureApplication(app)

  const port = Number(process.env.PORT ?? 3000)
  await app.listen(port)
}

void bootstrap()
