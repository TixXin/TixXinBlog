/**
 * @file app.module.ts
 * @description 根模块：装配全局配置、结构化日志与业务模块
 * @author TixXin
 * @since 2026-07-20
 */

import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { LoggerModule } from 'nestjs-pino'
import { validateEnv } from './config/env.validation'
import { mikroOrmOptions } from './config/mikro-orm.options'
import { AuthModule } from './modules/auth/auth.module'
import { CommentModule } from './modules/comment/comment.module'
import { FlashModule } from './modules/flash/flash.module'
import { MomentModule } from './modules/moment/moment.module'
import { HealthModule } from './modules/health/health.module'
import { PostModule } from './modules/post/post.module'
import { MediaModule } from './modules/media/media.module'
import { SiteModule } from './modules/site/site.module'
import { createLoggingOptions } from './config/logging'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { RateLimitGuard } from './common/guards/rate-limit.guard'
import { PostgreSqlDriver } from '@mikro-orm/postgresql'
import { AuditModule } from './modules/audit/audit.module'
import { AuditGateGuard } from './modules/audit/audit-gate.guard'
import { AuditInterceptor } from './modules/audit/audit.interceptor'
import { BackupModule } from './modules/backup/backup.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    // registerRequestContext 默认开启：HTTP 请求自动创建独立 EntityManager 上下文（development.md §5.5）
    MikroOrmModule.forRootAsync({
      driver: PostgreSqlDriver,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...mikroOrmOptions,
        clientUrl: config.getOrThrow<string>('DATABASE_URL'),
      }),
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createLoggingOptions(config.get<string>('LOG_LEVEL', 'info'), config.get<string>('NODE_ENV') === 'development'),
    }),
    HealthModule,
    AuthModule,
    PostModule,
    CommentModule,
    FlashModule,
    MomentModule,
    MediaModule,
    SiteModule,
    AuditModule,
    BackupModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: AuditGateGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
