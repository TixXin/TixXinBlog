/**
 * @file env.validation.ts
 * @description 环境变量 schema 与启动期校验，缺失或类型错误直接拒绝启动
 * @author TixXin
 * @since 2026-07-20
 */

import { isAbsolute } from 'node:path'
import { plainToInstance } from 'class-transformer'
import { requireDatabaseUrl } from './environment'
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min, MinLength, validateSync } from 'class-validator'
import { readOperationConfig } from '../modules/operations/operation-config'
import { parseTrustedProxyCidrs } from '../common/utils/trusted-proxy'

enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * 校验当前运行配置，保留旧可选字段的兼容性；声明字段不代表对应服务已经接入。
 * 必需配置和可用通道以同工作区 .env.example 与 docs/operations.md 为准。
 */
class EnvironmentVariables {
  /** 缺省按生产处理：漏配时保持限流、Secure Cookie 与 info 日志；本机开发由启动器或 .env.local 显式声明。 */
  @IsEnum(NodeEnv)
  @IsOptional()
  NODE_ENV: NodeEnv = NodeEnv.Production

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT: number = 3457

  @IsString()
  @IsOptional()
  LOG_LEVEL: string = 'info'

  /** 仅非生产环境可显式关闭限流，生产配置为 true 也不会生效。 */
  @IsIn(['true', 'false'])
  @IsOptional()
  RATE_LIMIT_DISABLED = 'false'

  /** 受管媒体目录；生产必须为绝对路径，避免随工作目录变化写到错误位置。 */
  @IsString()
  @IsOptional()
  MEDIA_DIRECTORY?: string

  @IsString()
  @IsOptional()
  CORS_ORIGIN?: string

  @IsString()
  @IsOptional()
  TRUSTED_PROXY_CIDRS: string = ''

  /** 可信代理注入访客地区文案的头名称；留言展示用，未注入则留空 */
  @IsString()
  @IsOptional()
  CLIENT_REGION_HEADER: string = 'x-client-region'

  @IsString()
  @Matches(/^postgres(?:ql)?:\/\//, { message: 'DATABASE_URL 必须为 PostgreSQL 连接地址' })
  DATABASE_URL!: string

  @IsString()
  @IsOptional()
  REDIS_URL?: string

  @IsString()
  @IsOptional()
  MEILISEARCH_URL?: string

  /** 密钥不再允许开发默认值，所有启动方式均必须配置。 */
  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET!: string

  @IsString()
  @IsOptional()
  ADMIN_DEFAULT_USERNAME?: string

  @IsString()
  @IsOptional()
  ADMIN_DEFAULT_PASSWORD?: string

  @IsIn(['true', 'false']) @IsOptional() OPERATIONS_WORKER_ENABLED = 'false'
  @IsIn(['true', 'false']) @IsOptional() NOTIFICATION_EMAIL_ENABLED = 'false'
  @IsString() @IsOptional() NOTIFICATION_SMTP_HOST?: string
  @IsInt() @Min(1) @Max(65535) @IsOptional() NOTIFICATION_SMTP_PORT: number = 587
  @IsIn(['true', 'false']) @IsOptional() NOTIFICATION_SMTP_SECURE = 'false'
  @IsIn(['true', 'false']) @IsOptional() NOTIFICATION_SMTP_ALLOW_LOCAL_PLAIN = 'false'
  @IsString() @IsOptional() NOTIFICATION_SMTP_USER?: string
  @IsString() @IsOptional() NOTIFICATION_SMTP_PASSWORD?: string
  @IsString() @IsOptional() NOTIFICATION_EMAIL_FROM?: string
  @IsString() @IsOptional() NOTIFICATION_EMAIL_TO?: string
  @IsString() @IsOptional() NOTIFICATION_SITE_URL?: string
  @IsInt() @Min(1) @Max(86400) @IsOptional() NOTIFICATION_MAIL_INTERVAL_SECONDS: number = 60
  @IsIn(['true', 'false']) @IsOptional() BACKUP_SCHEDULE_ENABLED = 'false'
  @IsString() @IsOptional() BACKUP_DIRECTORY?: string
  @IsString() @IsOptional() BACKUP_OWNER_ID?: string
  @IsIn(['docker', 'native']) @IsOptional() BACKUP_EXECUTION_MODE = 'docker'
  @IsString() @IsOptional() BACKUP_POSTGRES_CONTAINER?: string
  @IsInt() @Min(1) @Max(525600) @IsOptional() BACKUP_INTERVAL_MINUTES: number = 1440
  @IsInt() @Min(1) @Max(3650) @IsOptional() BACKUP_RETENTION_DAYS: number = 30
  @IsString() @IsOptional() BACKUP_TRANSFER_URL?: string
  @IsString() @IsOptional() BACKUP_TRANSFER_TOKEN?: string
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true })
  const errors = validateSync(validated, { skipMissingProperties: false, whitelist: true })
  if (errors.length > 0) {
    const detail = errors.map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`).join('; ')
    throw new Error(`环境变量校验失败 -> ${detail}`)
  }
  requireDatabaseUrl(validated.DATABASE_URL)
  if (validated.NODE_ENV === NodeEnv.Production) {
    const media = validated.MEDIA_DIRECTORY?.trim()
    if (!media || !isAbsolute(media)) throw new Error('环境变量校验失败 -> MEDIA_DIRECTORY: 生产环境必须配置为绝对路径')
  }
  parseTrustedProxyCidrs(validated.TRUSTED_PROXY_CIDRS)
  readOperationConfig(validated as unknown as NodeJS.ProcessEnv)
  return validated
}
