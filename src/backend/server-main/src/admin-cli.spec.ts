/**
 * @file admin-cli.spec.ts
 * @description 管理员命令行回归：业务错误原样输出、未知异常脱敏、重置密码使会话失效并写审计
 */
import { PassThrough } from 'node:stream'
import type { EntityManager } from '@mikro-orm/postgresql'
import * as argon2 from 'argon2'
import { AdminCliError, assertAdminPassword, describeCliFailure, readHiddenLine, resetAdminPassword } from './admin-cli'
import { AdminSession } from './entities/admin-session.entity'
import { AuditEntry } from './entities/audit-entry.entity'
import { RefreshToken } from './entities/refresh-token.entity'

describe('管理员命令行错误输出', () => {
  it('业务错误原样输出，数据库等未知异常只输出脱敏提示', () => {
    expect(describeCliFailure(new AdminCliError('该管理员已存在'), '脱敏提示')).toBe('该管理员已存在')
    expect(describeCliFailure(new Error('password authentication failed for user "tixxin"'), '脱敏提示')).toBe(
      '脱敏提示',
    )
    expect(describeCliFailure('raw', '脱敏提示')).toBe('脱敏提示')
  })

  it.each([undefined, '', '<required>', 'short', 'x'.repeat(129)])('拒绝不合规密码 %p', (value) => {
    expect(() => assertAdminPassword(value)).toThrow(AdminCliError)
  })

  it('合规密码原样返回，不做 trim', () => {
    expect(assertAdminPassword(' twelve-chars ')).toBe(' twelve-chars ')
  })

  it('隐藏输入读取一行且不回显到输出', async () => {
    const input = new PassThrough()
    const output = new PassThrough()
    let echoed = ''
    output.on('data', (chunk: Buffer) => (echoed += chunk.toString()))
    const reading = readHiddenLine('密码：', input, output)
    input.write('secret-password-123\n')
    await expect(reading).resolves.toBe('secret-password-123')
    expect(echoed).toContain('密码：')
    expect(echoed).not.toContain('secret-password-123')
  })
})

describe('resetAdminPassword', () => {
  async function setup(users: Array<{ id: string; username: string }>) {
    const records = await Promise.all(
      users.map(async (user) => ({
        ...user,
        sessionVersion: 3,
        passwordHash: await argon2.hash('old-password-123', { type: argon2.argon2id }),
      })),
    )
    const em = {
      transactional: jest.fn(),
      findOne: jest.fn(
        async (_entity: unknown, where: { username: string }) =>
          records.find((user) => user.username === where.username) ?? null,
      ),
      find: jest.fn(async () => records),
      nativeUpdate: jest.fn(async (entity: unknown) => (entity === AdminSession ? 2 : 5)),
      create: jest.fn(),
      flush: jest.fn().mockResolvedValue(undefined),
    }
    em.transactional.mockImplementation((run: (manager: unknown) => unknown) => run(em))
    return { em, records, manager: em as unknown as EntityManager }
  }

  it('argon2id 重置、递增 sessionVersion、撤销全部会话与令牌并写审计', async () => {
    const { em, records, manager } = await setup([{ id: 'user-1', username: 'admin' }])
    const result = await resetAdminPassword(manager, { password: 'brand-new-password' })
    const user = records[0]!
    expect(user.passwordHash).toMatch(/^\$argon2id\$/)
    expect(await argon2.verify(user.passwordHash, 'brand-new-password')).toBe(true)
    expect(user.sessionVersion).toBe(4)
    expect(em.nativeUpdate).toHaveBeenCalledWith(AdminSession, { adminUser: user, revokedAt: null }, expect.anything())
    expect(em.nativeUpdate).toHaveBeenCalledWith(RefreshToken, { adminUser: user, revokedAt: null }, expect.anything())
    expect(em.create).toHaveBeenCalledWith(
      AuditEntry,
      expect.objectContaining({
        action: 'auth.password-reset',
        resourceType: 'account',
        resourceId: 'user-1',
        state: 'success',
        summary: { fields: ['password'], counts: { revokedSessions: 2, revokedTokens: 5 } },
      }),
    )
    expect(JSON.stringify(em.create.mock.calls)).not.toContain('brand-new-password')
    expect(result).toEqual({ id: 'user-1', username: 'admin', sessionVersion: 4, revokedSessions: 2, revokedTokens: 5 })
  })

  it('指定用户名不存在、多个管理员未指定、与原密码相同时给出明确业务错误且不写入', async () => {
    const single = await setup([{ id: 'user-1', username: 'admin' }])
    await expect(
      resetAdminPassword(single.manager, { username: 'ghost', password: 'brand-new-password' }),
    ).rejects.toThrow(new AdminCliError('管理员 ghost 不存在'))
    await expect(resetAdminPassword(single.manager, { password: 'old-password-123' })).rejects.toThrow(
      '新密码不能与当前密码相同',
    )
    const multiple = await setup([
      { id: 'user-1', username: 'admin' },
      { id: 'user-2', username: 'editor' },
    ])
    await expect(resetAdminPassword(multiple.manager, { password: 'brand-new-password' })).rejects.toThrow(
      'ADMIN_RESET_USERNAME',
    )
    expect(single.em.create).not.toHaveBeenCalled()
    expect(multiple.em.create).not.toHaveBeenCalled()
    const named = await resetAdminPassword(multiple.manager, { username: ' editor ', password: 'brand-new-password' })
    expect(named.id).toBe('user-2')
  })

  it('密码不合规时不访问数据库', async () => {
    const { em, manager } = await setup([{ id: 'user-1', username: 'admin' }])
    await expect(resetAdminPassword(manager, { password: 'short' })).rejects.toBeInstanceOf(AdminCliError)
    expect(em.transactional).not.toHaveBeenCalled()
  })
})
