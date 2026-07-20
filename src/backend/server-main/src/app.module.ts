/**
 * @file app.module.ts
 * @description 根模块：装配全局配置、结构化日志与业务模块
 * @author TixXin
 * @since 2026-07-20
 */

import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { LoggerModule } from 'nestjs-pino'
import { validateEnv } from './config/env.validation'
import { HealthModule } from './modules/health/health.module'

// TODO(实体建模阶段): 注册 MikroOrmModule.forRoot(mikro-orm.config.ts) 并接入 PostgreSQL
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
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
  ],
})
export class AppModule {}
