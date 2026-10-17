/**
 * @file auth.service.spec.ts
 * @description 刷新令牌重放回归：已轮换令牌再次使用时撤销整条会话链并写审计
 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { Logger } from '@nestjs/common'
import type { JwtService } from '@nestjs/jwt'
import { AdminSession } from '../../entities/admin-session.entity'
import { AdminUser } from '../../entities/admin-user.entity'
import { RefreshToken } from '../../entities/refresh-token.entity'
import type { AuditService } from '../audit/audit.service'
import type { AuthSessionsService } from './auth-sessions.service'
import { AuthService } from './auth.service'

const traceId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

function setup(options: { revokedAt?: Date; sessionRevoked?: boolean; legacy?: boolean; auditFails?: boolean } = {}) {
  const now = Date.now()
  const user = { id: 'user-1', username: 'admin', sessionVersion: 2 }
  const session = {
    id: 'session-1',
    revokedAt: options.sessionRevoked ? new Date(now - 1000) : undefined,
    expiresAt: new Date(now + 60000),
  } as unknown as AdminSession
  const record = {
    adminUser: user,
    session: options.legacy ? undefined : session,
    revokedAt: options.revokedAt,
    expiresAt: new Date(now + 60000),
  } as unknown as RefreshToken
  const em = {
    transactional: jest.fn(),
    findOne: jest.fn(async (entity: unknown) =>
      entity === RefreshToken ? record : entity === AdminUser ? user : entity === AdminSession ? session : null,
    ),
    nativeUpdate: jest.fn().mockResolvedValue(3),
    create: jest.fn((_entity: unknown, data: Record<string, unknown>) => data),
    flush: jest.fn().mockResolvedValue(undefined),
  }
  em.transactional.mockImplementation((run: (manager: unknown) => unknown) => run(em))
  const audit = {
    begin: options.auditFails
      ? jest.fn().mockRejectedValue(new Error('audit down'))
      : jest.fn().mockResolvedValue('audit-1'),
    complete: jest.fn().mockResolvedValue(true),
  }
  const jwt = { sign: jest.fn().mockReturnValue('access-token') }
  const service = new AuthService(
    em as unknown as EntityManager,
    jwt as unknown as JwtService,
    {} as AuthSessionsService,
    audit as unknown as AuditService,
  )
  return { service, em, audit, session, record }
}

describe('AuthService.refresh', () => {
  it('有效令牌正常轮换，不写重放审计', async () => {
    const { service, audit, record } = setup()
    const result = await service.refresh('plain-token', 'UA', traceId)
    expect(result.accessToken).toBe('access-token')
    expect(record.revokedAt).toBeInstanceOf(Date)
    expect(audit.begin).not.toHaveBeenCalled()
  })

  it('已轮换令牌被重放：撤销会话及其全部令牌，返回 401 并写审计', async () => {
    const { service, em, audit, session } = setup({ revokedAt: new Date(Date.now() - 5000) })
    await expect(service.refresh('plain-token', 'UA', traceId)).rejects.toMatchObject({ status: 401 })
    expect(session.revokedAt).toBeInstanceOf(Date)
    expect(em.nativeUpdate).toHaveBeenCalledWith(
      RefreshToken,
      { session, revokedAt: null },
      { revokedAt: session.revokedAt },
    )
    expect(audit.begin).toHaveBeenCalledWith(
      { action: 'auth.refresh-reuse', resourceType: 'session', resourceId: 'session-1' },
      { id: 'user-1', name: 'admin', sessionId: 'session-1' },
      traceId,
    )
    expect(audit.complete).toHaveBeenCalledWith(
      'audit-1',
      expect.objectContaining({
        state: 'success',
        statusCode: 401,
        summary: { fields: [], counts: { revokedTokens: 3 } },
      }),
    )
  })

  it('旧版无会话令牌重放时撤销该管理员全部无会话令牌', async () => {
    const { service, em, audit } = setup({ revokedAt: new Date(Date.now() - 5000), legacy: true })
    await expect(service.refresh('plain-token', undefined, 'not-a-uuid')).rejects.toMatchObject({ status: 401 })
    expect(em.nativeUpdate).toHaveBeenCalledWith(
      RefreshToken,
      expect.objectContaining({ session: null, revokedAt: null }),
      expect.anything(),
    )
    expect(audit.begin).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.refresh-reuse' }),
      expect.anything(),
      undefined,
    )
  })

  it('会话已正常撤销（登出、改密）后的旧令牌只返回 401，不重复处置', async () => {
    const { service, em, audit } = setup({ revokedAt: new Date(Date.now() - 5000), sessionRevoked: true })
    await expect(service.refresh('plain-token')).rejects.toMatchObject({ status: 401 })
    expect(em.nativeUpdate).not.toHaveBeenCalled()
    expect(audit.begin).not.toHaveBeenCalled()
  })

  it('审计存储不可用时撤销仍生效并返回 401', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    try {
      const { service, session } = setup({ revokedAt: new Date(Date.now() - 5000), auditFails: true })
      await expect(service.refresh('plain-token')).rejects.toMatchObject({ status: 401 })
      expect(session.revokedAt).toBeInstanceOf(Date)
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('审计写入失败'))
    } finally {
      warn.mockRestore()
    }
  })
})
