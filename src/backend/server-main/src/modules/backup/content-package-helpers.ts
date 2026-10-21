/**
 * @file content-package-helpers.ts
 * @description 内容包解析的基础类型校验、字段提取与哈希计算纯函数。
 */
import { BadRequestException } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { isISO8601, validateSync } from 'class-validator'
import { createHash } from 'node:crypto'
import { msg, type MessageKey } from '../../common/i18n'

export function packageHash(value: unknown): string {
  return createHash('sha256')
    .update(
      JSON.stringify(value, (_key, item: unknown) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
          : item,
      ),
    )
    .digest('hex')
}

/** 中文字段名各自登记为字典条目，只有英文字段路径作为 {path} 参数 */
export type PackageFieldKey = Extract<MessageKey, `package.field${string}`>

export function fail(path: string | PackageFieldKey): never {
  throw new BadRequestException(
    path.startsWith('package.field') ? msg(path as PackageFieldKey) : msg('package.invalidField', { path }),
  )
}

export function text(value: unknown, path: string, max: number, min = 0): string {
  if (typeof value !== 'string' || value.length < min || value.length > max || (min > 0 && !value.trim()))
    return fail(path)
  return value
}

export function number(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 2147483647) return fail(path)
  return Number(value)
}

export function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') return fail(path)
  return value
}

export function date(value: unknown, path: string): string {
  const result = text(value, path, 40, 1)
  if (!isISO8601(result, { strict: true }) || !Number.isFinite(Date.parse(result))) return fail(path)
  return new Date(result).toISOString()
}

export function array(value: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) return fail(path)
  return value
}

export function record(value: unknown, path: string, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(path)
  const result = value as Record<string, unknown>
  if (Object.keys(result).some((key) => !keys.includes(key))) return fail(path)
  return result
}

export function packageImageUrl(value: string): boolean {
  if (!value || /^\/(?!\/)[^\\\s]*$/.test(value)) return true
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
  } catch {
    return false
  }
}

export function dto<T extends object>(type: new () => T, value: unknown, path: string): T {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(path)
  const result = plainToInstance(type, value)
  if (validateSync(result, { whitelist: true, forbidNonWhitelisted: true }).length) return fail(path)
  return result
}
