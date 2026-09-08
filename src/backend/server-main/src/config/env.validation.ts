/**
 * @file env.validation.ts
 * @description 环境变量 schema 与启动期校验，缺失或类型错误直接拒绝启动
 * @author TixXin
 * @since 2026-07-20
 */

import { plainToInstance } from 'class-transformer'
import { requireDatabaseUrl } from './environment'
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, Min, MinLength, validateSync } from 'class-validator'

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * 工程初始化阶段仅校验基础字段；DATABASE_URL / REDIS_URL / MEILISEARCH_URL 等
 * 依赖项将在对应模块接入时改为必填（见 docs/backend/development.md §7.3 完整清单）
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
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true })
  const errors = validateSync(validated, { skipMissingProperties: false, whitelist: true })
  if (errors.length > 0) {
    const detail = errors.map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`).join('; ')
    throw new Error(`环境变量校验失败 -> ${detail}`)
  }
  requireDatabaseUrl(validated.DATABASE_URL)
  return validated
}
