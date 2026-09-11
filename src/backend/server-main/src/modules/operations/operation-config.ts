/** @file operation-config.ts @description 运行任务的显式配置与安全状态；默认关闭，不在响应中返回秘密或磁盘路径 */
import { isAbsolute, resolve } from 'node:path'

export interface OperationConfig {
  workerEnabled: boolean
  email: {
    enabled: boolean
    host: string
    port: number
    secure: boolean
    localPlain: boolean
    user: string
    password: string
    from: string
    to: string
    siteUrl: string
    intervalSeconds: number
    missing: string[]
  }
  backup: {
    enabled: boolean
    directory: string
    ownerId: string
    mode: 'docker' | 'native'
    container: string
    intervalMinutes: number
    retentionDays: number
    transferUrl: string
    transferToken: string
    missing: string[]
  }
}
const loopback = (host: string) => ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host)
function integer(env: NodeJS.ProcessEnv, key: string, fallback: number, min: number, max: number) {
  if (env[key] === undefined || env[key] === '') return fallback
  const value = Number(env[key])
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`运行配置 ${key} 范围不合法`)
  return value
}
function enabled(env: NodeJS.ProcessEnv, key: string) {
  if (env[key] && !['true', 'false'].includes(env[key]!)) throw new Error(`运行配置 ${key} 必须为 true 或 false`)
  return env[key] === 'true'
}
export function readOperationConfig(env: NodeJS.ProcessEnv = process.env): OperationConfig {
  const host = env.NOTIFICATION_SMTP_HOST ?? ''
  const localPlain = enabled(env, 'NOTIFICATION_SMTP_ALLOW_LOCAL_PLAIN')
  if (localPlain && !loopback(host)) throw new Error('明文 SMTP 仅允许显式配置的本机捕获服务')
  const from = env.NOTIFICATION_EMAIL_FROM ?? '',
    to = env.NOTIFICATION_EMAIL_TO ?? ''
  const address = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
  const siteUrl = env.NOTIFICATION_SITE_URL ?? ''
  let validSite = false
  try {
    const url = new URL(siteUrl)
    validSite =
      (url.protocol === 'https:' || (url.protocol === 'http:' && loopback(url.hostname))) &&
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash
  } catch {
    /* 缺配置通过状态展示。 */
  }
  const emailMissing = [
    !host && 'NOTIFICATION_SMTP_HOST',
    !address.test(from) && 'NOTIFICATION_EMAIL_FROM',
    !address.test(to) && 'NOTIFICATION_EMAIL_TO',
    !validSite && 'NOTIFICATION_SITE_URL',
    !!env.NOTIFICATION_SMTP_USER !== !!env.NOTIFICATION_SMTP_PASSWORD && 'NOTIFICATION_SMTP_USER/PASSWORD',
  ].filter(Boolean) as string[]
  const directory = env.BACKUP_DIRECTORY ?? '',
    ownerId = env.BACKUP_OWNER_ID ?? ''
  const mode = env.BACKUP_EXECUTION_MODE ?? 'docker'
  if (!['docker', 'native'].includes(mode)) throw new Error('BACKUP_EXECUTION_MODE 只能为 docker 或 native')
  const transferUrl = env.BACKUP_TRANSFER_URL ?? '',
    transferToken = env.BACKUP_TRANSFER_TOKEN ?? ''
  let validTransfer = !transferUrl && !transferToken
  if (transferUrl) {
    try {
      const url = new URL(transferUrl)
      validTransfer =
        (url.protocol === 'https:' || (url.protocol === 'http:' && loopback(url.hostname))) &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        transferToken.length >= 32
    } catch {
      /* 缺配置通过状态展示。 */
    }
  }
  return {
    workerEnabled: enabled(env, 'OPERATIONS_WORKER_ENABLED'),
    email: {
      enabled: enabled(env, 'NOTIFICATION_EMAIL_ENABLED'),
      host,
      port: integer(env, 'NOTIFICATION_SMTP_PORT', 587, 1, 65535),
      secure: enabled(env, 'NOTIFICATION_SMTP_SECURE'),
      localPlain,
      user: env.NOTIFICATION_SMTP_USER ?? '',
      password: env.NOTIFICATION_SMTP_PASSWORD ?? '',
      from,
      to,
      siteUrl,
      intervalSeconds: integer(env, 'NOTIFICATION_MAIL_INTERVAL_SECONDS', 60, 1, 86400),
      missing: emailMissing,
    },
    backup: {
      enabled: enabled(env, 'BACKUP_SCHEDULE_ENABLED'),
      directory: directory ? resolve(directory) : '',
      ownerId,
      mode: mode as 'docker' | 'native',
      container: env.BACKUP_POSTGRES_CONTAINER ?? 'tixxin-blog-postgres',
      intervalMinutes: integer(env, 'BACKUP_INTERVAL_MINUTES', 1440, 1, 525600),
      retentionDays: integer(env, 'BACKUP_RETENTION_DAYS', 30, 1, 3650),
      transferUrl,
      transferToken,
      missing: [
        (!directory || !isAbsolute(directory)) && 'BACKUP_DIRECTORY',
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ownerId) && 'BACKUP_OWNER_ID',
        !validTransfer && 'BACKUP_TRANSFER_URL/TOKEN',
      ].filter(Boolean) as string[],
    },
  }
}
export function operationConfigStatus(config = readOperationConfig()) {
  return {
    email: {
      enabled: config.email.enabled,
      configured: config.email.missing.length === 0,
      missing: config.email.missing,
    },
    backup: {
      enabled: config.backup.enabled,
      configured: config.backup.missing.length === 0,
      transferConfigured: !!config.backup.transferUrl && !config.backup.missing.includes('BACKUP_TRANSFER_URL/TOKEN'),
      missing: config.backup.missing,
    },
    workerEnabled: config.workerEnabled,
  }
}
