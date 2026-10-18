/**
 * @file auth.service.spec.ts
 * @description 认证单元回归：令牌签发与轮换、重放撤销、改密版本保护、登出及身份查询
 */
import { createHash } from 'node:crypto'
import { LockMode } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import { Logger } from '@nestjs/common'
import type { JwtService } from '@nestjs/jwt'
import * as argon2 from 'argon2'
import { ErrorCode } from '../../common/constants/error-codes'
import { AdminSession } from '../../entities/admin-session.entity'
import { AdminUser } from '../../entities/admin-user.entity'
import { RefreshToken } from '../../entities/refresh-token.entity'
import type { AuditService } from '../audit/audit.service'
import type { AuthSessionsService } from './auth-sessions.service'
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_MS } from './auth.constants'
import { AuthService } from './auth.service'

// 只替换密码计算边界，不初始化 ORM 或连接数据库；随机刷新凭据与 SHA-256 使用真实实现。
jest.mock('argon2', () => ({
  argon2id: 2,
  hash: jest.fn().mockResolvedValue('dummy-password-hash'),
  verify: jest.fn(),
}))

const now = new Date('2026-10-18T08:00:00.000Z')
const userId = '7e120d6a-4214-49d4-9165-3b72ed504101'
const sessionId = '7e120d6a-4214-49d4-9165-3b72ed504102'
const otherSessionId = '7e120d6a-4214-49d4-9165-3b72ed504103'
const traceId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')
const locked = { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true }
const unauthorized = { status: 401, code: ErrorCode.Unauthorized }
const refreshExpired = { status: 401, code: ErrorCode.RefreshTokenExpired }

function setup() {
  const user: AdminUser = Object.assign(new AdminUser(), {
    id: userId,
    username: 'admin',
    passwordHash: 'current-password-hash',
    sessionVersion: 2,
  })
  const session: AdminSession = Object.assign(new AdminSession(), {
    id: sessionId,
    adminUser: user,
    deviceLabel: 'Chrome / macOS',
    loginAt: new Date(now.getTime() - 60000),
    lastRefreshedAt: new Date(now.getTime() - 60000),
    expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
  })
  const record: RefreshToken = Object.assign(new RefreshToken(), {
    id: 1,
    adminUser: user,
    session,
    tokenHash: sha256('plain-token'),
    expiresAt: new Date(now.getTime() + 60000),
  })
  const findOne = async (entity: unknown): Promise<AdminUser | AdminSession | RefreshToken | null> => {
    if (entity === AdminUser) return user
    if (entity === AdminSession) return session
    if (entity === RefreshToken) return record
    throw new Error('未声明的实体查询')
  }
  const tx = {
    findOne: jest.fn(findOne),
    nativeUpdate: jest.fn().mockResolvedValue(3),
    create: jest.fn((_entity: unknown, data: Record<string, unknown>) => data),
    flush: jest.fn().mockResolvedValue(undefined),
  }
  // 事务管理器与外层管理器分开，防止事务中的操作意外使用外层连接而测试仍通过。
  const committed = jest.fn()
  const em = {
    findOne: jest.fn(findOne),
    flush: jest.fn().mockResolvedValue(undefined),
    transactional: jest.fn(async (run: (manager: unknown) => Promise<unknown>) => {
      const result = await run(tx)
      committed()
      return result
    }),
  }
  const sessions = {
    create: jest.fn().mockReturnValue(session),
    revoke: jest.fn().mockResolvedValue({ ok: true, revoked: 1 }),
  }
  const audit = {
    begin: jest.fn().mockResolvedValue('audit-1'),
    complete: jest.fn().mockResolvedValue(true),
  }
  const jwt = {
    sign: jest.fn().mockReturnValue('access-token'),
    verifyAsync: jest.fn().mockResolvedValue({ sub: userId, sid: sessionId, version: 2, username: 'admin' }),
  }
  const service = new AuthService(
    em as unknown as EntityManager,
    jwt as unknown as JwtService,
    sessions as unknown as AuthSessionsService,
    audit as unknown as AuditService,
  )
  return { service, em, tx, committed, sessions, audit, jwt, user, session, record }
}

type Fixture = ReturnType<typeof setup>

function expectNoIssue({ tx, jwt, sessions }: Fixture) {
  expect(tx.create).not.toHaveBeenCalled()
  expect(jwt.sign).not.toHaveBeenCalled()
  expect(sessions.create).not.toHaveBeenCalled()
}

beforeEach(() => {
  jest.useFakeTimers({ now })
  jest.clearAllMocks()
  jest.mocked(argon2.verify).mockReset().mockResolvedValue(true)
  jest.mocked(argon2.hash).mockReset().mockResolvedValue('new-password-hash')
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('AuthService.login', () => {
  it('核验密码后锁定账号，以当前版本签发 JWT；刷新凭据只持久化哈希并绑定会话', async () => {
    const { service, em, tx, sessions, jwt, user, session } = setup()
    const current = Object.assign(new AdminUser(), user, { sessionVersion: 5 })
    tx.findOne.mockResolvedValueOnce(current)
    const result = await service.login('admin', 'current-password', 'browser-agent')

    expect(em.findOne).toHaveBeenCalledWith(AdminUser, { username: 'admin' })
    expect(argon2.verify).toHaveBeenCalledWith('current-password-hash', 'current-password')
    expect(em.transactional).toHaveBeenCalledTimes(1)
    expect(tx.findOne).toHaveBeenCalledWith(AdminUser, { id: userId }, locked)
    expect(current.lastLoginAt).toEqual(now)
    expect(sessions.create).toHaveBeenCalledWith(tx, current, 'browser-agent')
    expect(result).toEqual({
      accessToken: 'access-token',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: { id: userId, username: 'admin' },
      refreshTokenPlain: expect.stringMatching(/^[A-Za-z0-9_-]{64}$/),
    })
    expect(tx.create).toHaveBeenCalledTimes(1)
    expect(tx.create).toHaveBeenCalledWith(RefreshToken, {
      adminUser: current,
      session,
      tokenHash: sha256(result.refreshTokenPlain),
      expiresAt: session.expiresAt,
      createdAt: now,
    })
    expect(JSON.stringify(tx.create.mock.calls)).not.toContain(result.refreshTokenPlain)
    expect(tx.flush).toHaveBeenCalledTimes(1)
    expect(jwt.sign).toHaveBeenCalledTimes(1)
    expect(jwt.sign).toHaveBeenCalledWith({ sub: userId, username: 'admin', version: 5, sid: sessionId })
    expect(tx.flush.mock.invocationCallOrder[0]).toBeLessThan(jwt.sign.mock.invocationCallOrder[0]!)
  })

  it('未知账号仍校验占位哈希，并与密码错误保持相同业务错误', async () => {
    const fixture = setup()
    fixture.em.findOne.mockResolvedValueOnce(null)
    await expect(fixture.service.login('missing', 'password')).rejects.toMatchObject({
      ...unauthorized,
      message: '用户名或密码错误',
    })
    expect(argon2.verify).toHaveBeenCalledWith('dummy-password-hash', 'password')
    expect(fixture.em.transactional).not.toHaveBeenCalled()
    expectNoIssue(fixture)
  })

  it.each(['不匹配', '校验异常'])('密码%s时拒绝登录，不创建会话', async (state) => {
    const fixture = setup()
    if (state === '不匹配') jest.mocked(argon2.verify).mockResolvedValueOnce(false)
    else jest.mocked(argon2.verify).mockRejectedValueOnce(new Error('invalid hash'))
    await expect(fixture.service.login('admin', 'wrong-password')).rejects.toMatchObject({
      ...unauthorized,
      message: '用户名或密码错误',
    })
    expect(fixture.em.transactional).not.toHaveBeenCalled()
    expectNoIssue(fixture)
  })

  it.each(['已删除', '已改密'])('密码校验后账号%s时，锁内重新读取会拒绝旧凭据', async (state) => {
    const fixture = setup()
    fixture.tx.findOne.mockResolvedValueOnce(
      state === '已删除' ? null : Object.assign(new AdminUser(), fixture.user, { passwordHash: 'changed-hash' }),
    )
    await expect(fixture.service.login('admin', 'current-password')).rejects.toMatchObject({
      ...unauthorized,
      message: '账号凭据已变化，请重新登录',
    })
    expectNoIssue(fixture)
    expect(fixture.tx.flush).not.toHaveBeenCalled()
  })

  it('持久化失败时传播原异常，不签发可交付的访问令牌', async () => {
    const { service, tx, jwt, committed } = setup()
    const failure = new Error('flush failed')
    tx.flush.mockRejectedValueOnce(failure)
    await expect(service.login('admin', 'current-password')).rejects.toBe(failure)
    expect(jwt.sign).not.toHaveBeenCalled()
    expect(committed).not.toHaveBeenCalled()
  })
})

describe('AuthService.refresh', () => {
  it('固定按账号、令牌、会话加锁；轮换凭据并延长原会话，不更改原登录时间', async () => {
    const { service, em, tx, audit, jwt, sessions, user, session, record } = setup()
    const loginAt = session.loginAt
    session.expiresAt = new Date(now.getTime() + 60000)
    const result = await service.refresh('plain-token', 'UA', traceId)
    expect(em.findOne).not.toHaveBeenCalled()
    expect(tx.findOne.mock.calls).toEqual([
      [RefreshToken, { tokenHash: sha256('plain-token') }],
      [AdminUser, { id: userId }, locked],
      [RefreshToken, { tokenHash: sha256('plain-token') }, locked],
      [AdminSession, { id: sessionId, adminUser: user }, locked],
    ])
    expect(record.revokedAt).toEqual(now)
    expect(session.loginAt).toBe(loginAt)
    expect(session.lastRefreshedAt).toEqual(now)
    expect(session.expiresAt).toEqual(new Date(now.getTime() + REFRESH_TOKEN_TTL_MS))
    expect(result.refreshTokenPlain).toMatch(/^[A-Za-z0-9_-]{64}$/)
    expect(result.refreshTokenPlain).not.toBe('plain-token')
    expect(tx.create).toHaveBeenCalledTimes(1)
    expect(tx.create).toHaveBeenCalledWith(RefreshToken, {
      adminUser: user,
      tokenHash: sha256(result.refreshTokenPlain),
      session,
      expiresAt: session.expiresAt,
      createdAt: now,
    })
    expect(result).toMatchObject({ accessToken: 'access-token', expiresIn: ACCESS_TOKEN_TTL_SECONDS })
    expect(jwt.sign).toHaveBeenCalledWith({ sub: userId, username: 'admin', version: 2, sid: sessionId })
    expect(sessions.create).not.toHaveBeenCalled()
    expect(tx.flush).toHaveBeenCalledTimes(1)
    expect(audit.begin).not.toHaveBeenCalled()
  })

  it('旧版有效令牌补建稳定会话，保留未知登录时间且关联新旧刷新记录', async () => {
    const { service, tx, sessions, user, session, record } = setup()
    record.session = undefined
    await service.refresh('plain-token', 'legacy-agent')
    expect(sessions.create).toHaveBeenCalledWith(tx, user, 'legacy-agent')
    expect(session.loginAt).toBeUndefined()
    expect(record.session).toBe(session)
    expect(record.revokedAt).toEqual(now)
    expect(tx.create).toHaveBeenCalledWith(RefreshToken, expect.objectContaining({ session }))
  })

  it('找不到刷新记录时直接拒绝，不锁定账号或签发令牌', async () => {
    const fixture = setup()
    fixture.tx.findOne.mockResolvedValueOnce(null)
    await expect(fixture.service.refresh('unknown')).rejects.toMatchObject(refreshExpired)
    expect(fixture.tx.findOne).toHaveBeenCalledTimes(1)
    expectNoIssue(fixture)
  })

  it('刷新记录对应账号已删除时拒绝继续读取和轮换', async () => {
    const fixture = setup()
    fixture.tx.findOne.mockResolvedValueOnce(fixture.record).mockResolvedValueOnce(null)
    await expect(fixture.service.refresh('plain-token')).rejects.toMatchObject(unauthorized)
    expect(fixture.tx.findOne).toHaveBeenCalledTimes(2)
    expectNoIssue(fixture)
  })

  it.each(['已删除', '刚好到期', '已经过期', '已撤销且过期'])('锁内刷新记录%s时不轮换或误报重放', async (state) => {
    const fixture = setup()
    if (state === '已删除') {
      fixture.tx.findOne
        .mockResolvedValueOnce(fixture.record)
        .mockResolvedValueOnce(fixture.user)
        .mockResolvedValueOnce(null)
    } else {
      fixture.record.expiresAt = new Date(now.getTime() - (state === '刚好到期' ? 0 : 1))
      if (state === '已撤销且过期') fixture.record.revokedAt = new Date(now.getTime() - 1000)
    }
    await expect(fixture.service.refresh('plain-token')).rejects.toMatchObject(refreshExpired)
    expectNoIssue(fixture)
    expect(fixture.tx.nativeUpdate).not.toHaveBeenCalled()
    expect(fixture.audit.begin).not.toHaveBeenCalled()
  })

  it.each(['不存在', '已撤销', '刚好到期', '已经过期'])('有效刷新令牌所属会话%s时拒绝刷新', async (state) => {
    const fixture = setup()
    if (state === '不存在') {
      fixture.tx.findOne
        .mockResolvedValueOnce(fixture.record)
        .mockResolvedValueOnce(fixture.user)
        .mockResolvedValueOnce(fixture.record)
        .mockResolvedValueOnce(null)
    } else if (state === '已撤销') fixture.session.revokedAt = new Date(now.getTime() - 1000)
    else fixture.session.expiresAt = new Date(now.getTime() - (state === '刚好到期' ? 0 : 1))
    await expect(fixture.service.refresh('plain-token')).rejects.toMatchObject(refreshExpired)
    expectNoIssue(fixture)
    expect(fixture.record.revokedAt).toBeUndefined()
    expect(fixture.tx.flush).not.toHaveBeenCalled()
  })

  it('已轮换令牌被重放时撤销整条会话链，事务提交后写审计并返回 401', async () => {
    const fixture = setup()
    const { service, tx, committed, audit, user, session, record } = fixture
    record.revokedAt = new Date(now.getTime() - 5000)
    await expect(service.refresh('plain-token', 'UA', traceId)).rejects.toMatchObject(refreshExpired)
    expect(session.revokedAt).toEqual(now)
    expect(tx.nativeUpdate).toHaveBeenCalledTimes(1)
    expect(tx.nativeUpdate).toHaveBeenCalledWith(RefreshToken, { session, revokedAt: null }, { revokedAt: now })
    expect(tx.findOne).toHaveBeenLastCalledWith(AdminSession, { id: sessionId, adminUser: user }, locked)
    expect(committed).toHaveBeenCalledTimes(1)
    expect(committed.mock.invocationCallOrder[0]).toBeLessThan(audit.begin.mock.invocationCallOrder[0]!)
    const actor = { id: userId, name: 'admin', sessionId }
    expect(audit.begin).toHaveBeenCalledWith(
      { action: 'auth.refresh-reuse', resourceType: 'session', resourceId: sessionId },
      actor,
      traceId,
    )
    expect(audit.complete).toHaveBeenCalledWith('audit-1', {
      actor,
      resourceId: sessionId,
      state: 'success',
      statusCode: 401,
      summary: { fields: [], counts: { revokedTokens: 3 } },
    })
    expect(JSON.stringify(audit.begin.mock.calls)).not.toContain('plain-token')
    expect(JSON.stringify(audit.complete.mock.calls)).not.toContain(record.tokenHash)
    expectNoIssue(fixture)
  })

  it('旧版无会话令牌重放仅撤销该账号的无会话令牌，丢弃非法 traceId', async () => {
    const { service, tx, audit, user, record } = setup()
    record.revokedAt = new Date(now.getTime() - 5000)
    record.session = undefined
    await expect(service.refresh('plain-token', undefined, 'not-a-uuid')).rejects.toMatchObject(refreshExpired)
    expect(tx.nativeUpdate).toHaveBeenCalledTimes(1)
    expect(tx.nativeUpdate).toHaveBeenCalledWith(
      RefreshToken,
      { adminUser: user, session: null, revokedAt: null },
      { revokedAt: now },
    )
    expect(audit.begin).toHaveBeenCalledWith(
      { action: 'auth.refresh-reuse', resourceType: 'session', resourceId: undefined },
      { id: userId, name: 'admin', sessionId: undefined },
      undefined,
    )
  })

  it('旧版链已无活跃令牌时只拒绝，不重复写重放审计', async () => {
    const fixture = setup()
    fixture.record.revokedAt = new Date(now.getTime() - 5000)
    fixture.record.session = undefined
    fixture.tx.nativeUpdate.mockResolvedValueOnce(0)
    await expect(fixture.service.refresh('plain-token')).rejects.toMatchObject(refreshExpired)
    expect(fixture.audit.begin).not.toHaveBeenCalled()
    expectNoIssue(fixture)
  })

  it.each(['不存在', '已撤销', '已过期'])('重放令牌的会话%s时不重复处置或写审计', async (state) => {
    const fixture = setup()
    fixture.record.revokedAt = new Date(now.getTime() - 5000)
    if (state === '不存在') {
      fixture.tx.findOne
        .mockResolvedValueOnce(fixture.record)
        .mockResolvedValueOnce(fixture.user)
        .mockResolvedValueOnce(fixture.record)
        .mockResolvedValueOnce(null)
    } else if (state === '已撤销') fixture.session.revokedAt = new Date(now.getTime() - 1000)
    else fixture.session.expiresAt = new Date(now)
    await expect(fixture.service.refresh('plain-token')).rejects.toMatchObject(refreshExpired)
    expect(fixture.tx.nativeUpdate).not.toHaveBeenCalled()
    expect(fixture.audit.begin).not.toHaveBeenCalled()
    expectNoIssue(fixture)
  })

  it.each(['begin', 'complete'] as const)('审计 %s 失败不覆盖已提交的撤销结果，仍返回 401', async (method) => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    const { service, audit, session, record, committed } = setup()
    record.revokedAt = new Date(now.getTime() - 5000)
    audit[method].mockRejectedValueOnce(new Error('audit down'))
    await expect(service.refresh('plain-token')).rejects.toMatchObject(refreshExpired)
    expect(session.revokedAt).toEqual(now)
    expect(committed).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('审计写入失败'))
    if (method === 'begin') expect(audit.complete).not.toHaveBeenCalled()
  })

  it('重放撤销持久化失败时传播异常，不记录处置成功审计', async () => {
    const { service, tx, audit, record, committed } = setup()
    record.revokedAt = new Date(now.getTime() - 5000)
    const failure = new Error('revocation flush failed')
    tx.flush.mockRejectedValueOnce(failure)
    await expect(service.refresh('plain-token')).rejects.toBe(failure)
    expect(committed).not.toHaveBeenCalled()
    expect(audit.begin).not.toHaveBeenCalled()
  })
})

describe('AuthService.changePassword', () => {
  it('锁内校验当前版本和密码，使用 argon2id 改密并递增版本、撤销全部活跃授权', async () => {
    const { service, tx, em, user } = setup()
    await expect(service.changePassword(userId, 2, 'current-password', 'new-password')).resolves.toEqual({ ok: true })
    expect(em.transactional).toHaveBeenCalledTimes(1)
    expect(em.findOne).not.toHaveBeenCalled()
    expect(tx.findOne).toHaveBeenCalledTimes(1)
    expect(tx.findOne).toHaveBeenCalledWith(AdminUser, { id: userId }, locked)
    expect(argon2.verify).toHaveBeenCalledWith('current-password-hash', 'current-password')
    expect(argon2.hash).toHaveBeenCalledTimes(1)
    expect(argon2.hash).toHaveBeenCalledWith('new-password', {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    })
    expect(user.passwordHash).toBe('new-password-hash')
    expect(user.sessionVersion).toBe(3)
    expect(tx.nativeUpdate.mock.calls).toEqual([
      [AdminSession, { adminUser: user, revokedAt: null }, { revokedAt: now }],
      [RefreshToken, { adminUser: user, revokedAt: null }, { revokedAt: now }],
    ])
    expect(tx.flush).toHaveBeenCalledTimes(1)
    expect(tx.nativeUpdate.mock.invocationCallOrder[1]).toBeLessThan(tx.flush.mock.invocationCallOrder[0]!)
  })

  it.each(['账号不存在', '版本不匹配'])('%s时拒绝改密，不计算密码或写入', async (state) => {
    const { service, tx, user } = setup()
    if (state === '账号不存在') tx.findOne.mockResolvedValueOnce(null)
    else user.sessionVersion = 3
    await expect(service.changePassword(userId, 2, 'current-password', 'new-password')).rejects.toMatchObject(
      unauthorized,
    )
    expect(argon2.verify).not.toHaveBeenCalled()
    expect(argon2.hash).not.toHaveBeenCalled()
    expect(tx.nativeUpdate).not.toHaveBeenCalled()
    expect(tx.flush).not.toHaveBeenCalled()
  })

  it.each(['不匹配', '校验异常', '新旧相同'])('密码%s时返回 400，账号版本和授权保持原样', async (state) => {
    const { service, tx, user } = setup()
    if (state === '不匹配') jest.mocked(argon2.verify).mockResolvedValueOnce(false)
    if (state === '校验异常') jest.mocked(argon2.verify).mockRejectedValueOnce(new Error('bad hash'))
    const next = state === '新旧相同' ? 'current-password' : 'new-password'
    await expect(service.changePassword(userId, 2, 'current-password', next)).rejects.toMatchObject({
      status: 400,
      message: state === '新旧相同' ? '新密码不能与当前密码相同' : '当前密码不正确',
    })
    expect(user.sessionVersion).toBe(2)
    expect(user.passwordHash).toBe('current-password-hash')
    expect(argon2.hash).not.toHaveBeenCalled()
    expect(tx.nativeUpdate).not.toHaveBeenCalled()
    expect(tx.flush).not.toHaveBeenCalled()
  })

  it('新密码哈希失败时传播异常，不递增版本或撤销授权', async () => {
    const { service, tx, user } = setup()
    const failure = new Error('hash failed')
    jest.mocked(argon2.hash).mockRejectedValueOnce(failure)
    await expect(service.changePassword(userId, 2, 'current-password', 'new-password')).rejects.toBe(failure)
    expect(user.sessionVersion).toBe(2)
    expect(user.passwordHash).toBe('current-password-hash')
    expect(tx.nativeUpdate).not.toHaveBeenCalled()
    expect(tx.flush).not.toHaveBeenCalled()
  })
})

describe('AuthService.logout', () => {
  it('无凭据时幂等退出，不读取或写入', async () => {
    const { service, em, sessions, jwt } = setup()
    await expect(service.logout()).resolves.toBeUndefined()
    expect(em.findOne).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
    expect(sessions.revoke).not.toHaveBeenCalled()
    expect(jwt.verifyAsync).not.toHaveBeenCalled()
  })

  it('有效 Cookie 按哈希、有效期和撤销状态查询，再撤销所属会话', async () => {
    const { service, em, sessions } = setup()
    await expect(service.logout('plain-token')).resolves.toEqual({ id: userId, name: 'admin', sessionId, revoked: 1 })
    expect(em.findOne).toHaveBeenCalledTimes(1)
    expect(em.findOne).toHaveBeenCalledWith(
      RefreshToken,
      { tokenHash: sha256('plain-token'), revokedAt: null, expiresAt: { $gt: now } },
      { populate: ['adminUser'] },
    )
    expect(sessions.revoke).toHaveBeenCalledTimes(1)
    expect(sessions.revoke).toHaveBeenCalledWith(userId, sessionId)
  })

  it('无有效 Cookie 记录时不撤销任何会话', async () => {
    const { service, em, sessions } = setup()
    em.findOne.mockResolvedValueOnce(null)
    await expect(service.logout('expired-or-unknown')).resolves.toBeUndefined()
    expect(sessions.revoke).not.toHaveBeenCalled()
  })

  it('有效访问令牌可单独退出，使用令牌账号限定目标会话', async () => {
    const { service, em, sessions, jwt } = setup()
    await expect(service.logout(undefined, 'access-token')).resolves.toMatchObject({ sessionId, revoked: 1 })
    expect(jwt.verifyAsync).toHaveBeenCalledWith('access-token')
    expect(em.findOne).toHaveBeenCalledTimes(1)
    expect(em.findOne).toHaveBeenCalledWith(
      AdminSession,
      { id: sessionId, adminUser: userId },
      { populate: ['adminUser'] },
    )
    expect(sessions.revoke).toHaveBeenCalledTimes(1)
    expect(sessions.revoke).toHaveBeenCalledWith(userId, sessionId)
  })

  it('Cookie 与访问令牌指向同一会话时只撤销一次', async () => {
    const { service, sessions } = setup()
    await expect(service.logout('plain-token', 'access-token')).resolves.toMatchObject({ revoked: 1 })
    expect(sessions.revoke).toHaveBeenCalledTimes(1)
    expect(sessions.revoke).toHaveBeenCalledWith(userId, sessionId)
  })

  it('再次登录使 Cookie 与访问令牌会话不同时，两条会话均撤销并汇总数量', async () => {
    const { service, em, sessions, jwt, user, record } = setup()
    const other = Object.assign(new AdminSession(), { id: otherSessionId, adminUser: user })
    jwt.verifyAsync.mockResolvedValueOnce({ sub: userId, sid: otherSessionId, username: 'stale-name', version: 2 })
    em.findOne.mockResolvedValueOnce(record).mockResolvedValueOnce(other)
    await expect(service.logout('plain-token', 'other-access')).resolves.toEqual({
      id: userId,
      name: 'admin',
      sessionId: otherSessionId,
      revoked: 2,
    })
    expect(sessions.revoke.mock.calls).toEqual([
      [userId, sessionId],
      [userId, otherSessionId],
    ])
  })

  it('旧版无会话 Cookie 直接撤销该条刷新记录', async () => {
    const { service, em, sessions, record } = setup()
    record.session = undefined
    await expect(service.logout('plain-token')).resolves.toEqual({
      id: userId,
      name: 'admin',
      sessionId: undefined,
      revoked: 0,
    })
    expect(record.revokedAt).toEqual(now)
    expect(em.flush).toHaveBeenCalledTimes(1)
    expect(sessions.revoke).not.toHaveBeenCalled()
  })

  it.each([undefined, 'plain-token'])('非法或过期访问令牌不能授权撤销，但不妨碍有效 Cookie %p 退出', async (cookie) => {
    const { service, jwt, sessions, em } = setup()
    jwt.verifyAsync.mockRejectedValueOnce(new Error('jwt expired'))
    const result = await service.logout(cookie, 'invalid-access')
    if (cookie) {
      expect(result).toMatchObject({ sessionId, revoked: 1 })
      expect(sessions.revoke).toHaveBeenCalledTimes(1)
      expect(sessions.revoke).toHaveBeenCalledWith(userId, sessionId)
    } else {
      expect(result).toBeUndefined()
      expect(sessions.revoke).not.toHaveBeenCalled()
    }
    expect(em.findOne.mock.calls.filter(([entity]) => entity === AdminSession)).toHaveLength(0)
  })

  it.each([
    { sub: userId },
    { sub: userId, sid: 123 },
    { sub: userId, sid: 'invalid-session' },
    { sid: sessionId },
    { sub: 123, sid: sessionId },
    { sub: 'invalid-user', sid: sessionId },
    null,
  ])('访问令牌身份字段不合法时不查询或撤销：%p', async (payload) => {
    const { service, jwt, em, sessions } = setup()
    jwt.verifyAsync.mockResolvedValueOnce(payload)
    await expect(service.logout(undefined, 'malformed')).resolves.toBeUndefined()
    expect(em.findOne).not.toHaveBeenCalled()
    expect(sessions.revoke).not.toHaveBeenCalled()
  })

  it('访问令牌对应会话不存在或归属不匹配时不撤销', async () => {
    const { service, em, sessions } = setup()
    em.findOne.mockResolvedValueOnce(null)
    await expect(service.logout(undefined, 'access-token')).resolves.toBeUndefined()
    expect(em.findOne).toHaveBeenCalledWith(
      AdminSession,
      { id: sessionId, adminUser: userId },
      { populate: ['adminUser'] },
    )
    expect(sessions.revoke).not.toHaveBeenCalled()
  })

  it('已撤销会话保留审计身份，撤销数量为零', async () => {
    const { service, sessions } = setup()
    sessions.revoke.mockResolvedValueOnce({ ok: true, revoked: 0 })
    await expect(service.logout(undefined, 'access-token')).resolves.toEqual({
      id: userId,
      name: 'admin',
      sessionId,
      revoked: 0,
    })
  })

  it('会话撤销失败时向调用方传播异常，不返回退出成功', async () => {
    const { service, sessions } = setup()
    const failure = new Error('revoke failed')
    sessions.revoke.mockRejectedValueOnce(failure)
    await expect(service.logout('plain-token')).rejects.toBe(failure)
  })
})

describe('AuthService.getMe / hasSession', () => {
  it.each([undefined, now])('当前身份只返回公开字段，并序列化可选登录时间 %p', async (lastLoginAt) => {
    const { service, em, user } = setup()
    user.lastLoginAt = lastLoginAt
    await expect(service.getMe(userId)).resolves.toEqual({
      id: userId,
      username: 'admin',
      lastLoginAt: lastLoginAt?.toISOString(),
    })
    expect(em.findOne).toHaveBeenCalledWith(AdminUser, { id: userId })
  })

  it('账号不存在时不返回空身份', async () => {
    const { service, em } = setup()
    em.findOne.mockResolvedValueOnce(null)
    await expect(service.getMe(userId)).rejects.toMatchObject(unauthorized)
  })

  it.each([undefined, ''])('未提供刷新凭据 %p 时直接返回未登录', async (token) => {
    const { service, em } = setup()
    await expect(service.hasSession(token)).resolves.toBe(false)
    expect(em.findOne).not.toHaveBeenCalled()
  })

  it.each([true, false])('会话探测同时限制令牌与关联会话有效性，匹配结果为 %p', async (found) => {
    const { service, em, record } = setup()
    em.findOne.mockResolvedValueOnce(found ? record : null)
    await expect(service.hasSession('plain-token')).resolves.toBe(found)
    expect(em.findOne).toHaveBeenCalledTimes(1)
    expect(em.findOne).toHaveBeenCalledWith(RefreshToken, {
      tokenHash: sha256('plain-token'),
      revokedAt: null,
      expiresAt: { $gt: now },
      $or: [{ session: null }, { session: { revokedAt: null, expiresAt: { $gt: now } } }],
    })
  })
})
