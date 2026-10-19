/**
 * @file admin-cli.ts
 * @description 管理员命令行共用逻辑：明确业务错误、密码规则、隐藏输入与重置密码事务
 * @author TixXin
 * @since 2026-10-18
 */
import { createInterface } from 'node:readline'
import { Writable } from 'node:stream'
import type { Readable } from 'node:stream'
import { LockMode } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import * as argon2 from 'argon2'
import { AdminSession } from './entities/admin-session.entity'
import { AdminUser } from './entities/admin-user.entity'
import { AuditEntry } from './entities/audit-entry.entity'
import { RefreshToken } from './entities/refresh-token.entity'
import { zh } from './common/i18n'

/** 命令自身判定的业务错误（配置缺失、账号状态、密码不合规），可原样输出给操作者。 */
export class AdminCliError extends Error {
  override readonly name = 'AdminCliError'
}

/** 与后台改密一致：12–128 位，拒绝模板占位值。 */
export function assertAdminPassword(password: string | undefined, label = '新密码'): string {
  if (!password || password === '<required>') throw new AdminCliError(`请提供${label}`)
  if (password.length < 12) throw new AdminCliError(`${label}至少需要 12 个字符`)
  if (password.length > 128) throw new AdminCliError(`${label}不能超过 128 个字符`)
  return password
}

/** 业务错误原样输出；数据库等未知异常可能带连接参数，只输出脱敏提示。 */
export function describeCliFailure(error: unknown, fallback: string): string {
  return error instanceof AdminCliError ? error.message : fallback
}

/** 从终端读取一行且不回显；非交互输入（管道）同样可读，但调用方应优先使用环境变量。 */
export function readHiddenLine(prompt: string, input: Readable = process.stdin, output: Writable = process.stderr) {
  return new Promise<string>((resolve, reject) => {
    output.write(prompt)
    // 输入回显写入空流，终端上不显示密码字符。
    const muted = new Writable({ write: (_chunk, _encoding, done) => done() })
    const reader = createInterface({ input, output: muted, terminal: true })
    let answered = false
    reader.once('line', (line) => {
      answered = true
      output.write('\n')
      resolve(line)
      reader.close()
    })
    reader.once('close', () => {
      if (!answered) reject(new AdminCliError('未读取到密码输入'))
    })
    reader.once('SIGINT', () => reader.close())
  })
}

interface ResetPasswordResult {
  id: string
  username: string
  sessionVersion: number
  revokedSessions: number
  revokedTokens: number
}

/**
 * 重置管理员密码：argon2id 哈希、递增 sessionVersion 使全部访问令牌失效，
 * 撤销全部会话与刷新令牌，并在同一事务内写入审计。
 */
export async function resetAdminPassword(
  em: EntityManager,
  input: { username?: string; password: string },
): Promise<ResetPasswordResult> {
  const password = assertAdminPassword(input.password)
  const username = input.username?.trim()
  return em.transactional(async (tx) => {
    let user: AdminUser | null
    if (username) {
      user = await tx.findOne(AdminUser, { username }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      if (!user) throw new AdminCliError(`管理员 ${username} 不存在`)
    } else {
      const users = await tx.find(AdminUser, {}, { lockMode: LockMode.PESSIMISTIC_WRITE, limit: 2 })
      if (users.length === 0) throw new AdminCliError('尚无管理员账号，请先运行 admin-bootstrap 初始化')
      if (users.length > 1) throw new AdminCliError('存在多个管理员，请通过 ADMIN_RESET_USERNAME 指定账号')
      user = users[0]!
    }
    if (await argon2.verify(user.passwordHash, password).catch(() => false))
      throw new AdminCliError('新密码不能与当前密码相同')
    const now = new Date()
    user.passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    })
    user.sessionVersion += 1
    const revokedSessions = await tx.nativeUpdate(
      AdminSession,
      { adminUser: user, revokedAt: null },
      { revokedAt: now },
    )
    const revokedTokens = await tx.nativeUpdate(RefreshToken, { adminUser: user, revokedAt: null }, { revokedAt: now })
    tx.create(AuditEntry, {
      action: 'auth.password-reset',
      resourceType: 'account',
      resourceId: user.id,
      actorName: zh('audit.actor.cli'),
      state: 'success',
      summary: { fields: ['password'], counts: { revokedSessions, revokedTokens } },
      createdAt: now,
      finishedAt: now,
    })
    await tx.flush()
    return { id: user.id, username: user.username, sessionVersion: user.sessionVersion, revokedSessions, revokedTokens }
  })
}
