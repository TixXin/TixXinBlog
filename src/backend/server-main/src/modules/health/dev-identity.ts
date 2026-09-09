/** @file dev-identity.ts @description 仅本机开发探针使用的项目与数据库标识，不返回路径或凭据 */
import { createHash } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { resolve } from 'node:path'

export function devIdentity() {
  const digest = (value: string) => createHash('sha256').update(value).digest('hex')
  const root = realpathSync(resolve(process.cwd(), '../../..')).replaceAll('\\', '/')
  const database = new URL(process.env.DATABASE_URL!)
  return {
    service: 'server-main',
    workspace: digest(process.platform === 'win32' ? root.toLowerCase() : root),
    database: digest(`${database.protocol}//${database.username}@${database.host}${database.pathname}`),
    pid: process.pid,
    session: process.env.TIXXIN_DEV_SESSION ?? null,
  }
}
