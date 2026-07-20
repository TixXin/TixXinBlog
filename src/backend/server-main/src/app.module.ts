/**
 * @file app.module.ts
 * @description 根模块：装配全局配置、结构化日志与业务模块
 * @author TixXin
 * @since 2026-07-20
 */

import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { LoggerModule } from 'nestjs-pino'
import { validateEnv } from './config/env.validation'
import { mikroOrmOptions } from './config/mikro-orm.options'
import { HealthModule } from './modules/health/health.module'
import { PostModule } from './modules/post/post.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    // registerRequestContext 默认开启：HTTP 请求自动创建独立 EntityManager 上下文（development.md §5.5）
    MikroOrmModule.forRoot(mikroOrmOptions),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'debug',
        // 探针请求高频且无业务含义，不打日志
        autoLogging: {
          ignore: (req) => req.url === '/health' || req.url === '/ready',
        },
        transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
      },
    }),
    HealthModule,
    PostModule,
  ],
})
export class AppModule {}
