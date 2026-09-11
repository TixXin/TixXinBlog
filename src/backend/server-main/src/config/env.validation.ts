/**
 * @file env.validation.ts
 * @description 环境变量 schema 与启动期校验，缺失或类型错误直接拒绝启动
 * @author TixXin
 * @since 2026-07-20
 */

import { plainToInstance } from 'class-transformer'
import { requireDatabaseUrl } from './environment'
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min, MinLength, validateSync } from 'class-validator'
import { readOperationConfig } from '../modules/operations/operation-config'

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * 工程初始化阶段仅校验基础字段；DATABASE_URL / REDIS_URL / MEILISEARCH_URL 等
 * 依赖项将在对应模块接入时改为必填（见 docs/archive/backend-design/development.md §7.3 完整清单）
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  @IsOptional()
  NODE_ENV: NodeEnv = NodeEnv.Development

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT: number = 3000

  @IsString()
  @IsOptional()
  LOG_LEVEL: string = 'debug'

  @IsString()
  @IsOptional()
  CORS_ORIGIN?: string

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
  readOperationConfig(validated as unknown as NodeJS.ProcessEnv)
  return validated
}
