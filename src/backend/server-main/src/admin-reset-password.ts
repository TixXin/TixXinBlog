/**
 * @file admin-reset-password.ts
 * @description 服务器本机重置管理员密码：无 HTTP 入口，读取环境变量或终端隐藏输入，使全部会话失效并写审计。
 * @author TixXin
 * @since 2026-10-18
 */
import { MikroORM } from '@mikro-orm/postgresql'
import {
  ADMIN_PASSWORD_MIN_LENGTH,
  AdminCliError,
  describeCliFailure,
  readHiddenLine,
  resetAdminPassword,
} from './admin-cli'
import { mikroOrmOptions } from './config/mikro-orm.options'

async function readNewPassword(): Promise<string> {
  const fromEnvironment = process.env.ADMIN_RESET_PASSWORD
  if (fromEnvironment) return fromEnvironment
  if (!process.stdin.isTTY) throw new AdminCliError('非交互环境请通过 ADMIN_RESET_PASSWORD 提供新密码')
  const first = await readHiddenLine(`新密码（至少 ${ADMIN_PASSWORD_MIN_LENGTH} 个字符）：`)
  const second = await readHiddenLine('再次输入新密码：')
  if (first !== second) throw new AdminCliError('两次输入的密码不一致')
  return first
}

async function main(): Promise<void> {
  const username = process.env.ADMIN_RESET_USERNAME?.trim() || undefined
  const password = await readNewPassword()
  const orm = await MikroORM.init(mikroOrmOptions)
  try {
    const result = await resetAdminPassword(orm.em.fork(), { username, password })
    process.stdout.write(
      `管理员 ${result.username} 密码已重置；已撤销 ${result.revokedSessions} 个会话，所有已登录设备需重新登录\n`,
    )
  } finally {
    await orm.close(true)
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `重置管理员密码失败：${describeCliFailure(error, '数据库或运行环境异常，请检查连接配置与迁移状态')}\n`,
  )
  process.exitCode = 1
})
