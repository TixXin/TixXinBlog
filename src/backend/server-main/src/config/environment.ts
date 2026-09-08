/**
 * @file environment.ts
 * @description CLI 与服务共用环境加载顺序：进程环境优先，其次本地配置，再次通用配置
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'

export function loadLocalEnvironment(directory = process.cwd()): void {
  for (const name of ['.env.local', '.env']) {
    const path = resolve(directory, name)
    if (!existsSync(path)) continue
    for (const [key, value] of Object.entries(parseEnv(readFileSync(path, 'utf8')))) {
      if (process.env[key] === undefined) process.env[key] = value
    }
  }
}

export function requireDatabaseUrl(value = process.env.DATABASE_URL): string {
  try {
    if (!value) throw new Error('missing')
    const url = new URL(value)
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2)
      throw new Error('invalid')
    return value
  } catch {
    throw new Error('DATABASE_URL 必须显式配置为有效的 PostgreSQL 数据库地址')
  }
}
