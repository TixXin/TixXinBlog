/**
 * @file auth-sessions.service.spec.ts
 * @description 管理员会话单测：覆盖创建、活跃列表、归属校验、锁顺序与精确撤销范围。
 */
import { LockMode } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import { NotFoundException, UnauthorizedException } from '@nestjs/common'
import { AdminSession } from '../../entities/admin-session.entity'
import { AdminUser } from '../../entities/admin-user.entity'
import { RefreshToken } from '../../entities/refresh-token.entity'
import { REFRESH_TOKEN_TTL_MS } from './auth.constants'
import { AuthSessionsService } from './auth-sessions.service'

const now = new Date('2026-10-18T08:00:00.000Z')
const userId = 'admin-1'
const currentId = 'session-current'

function makeSession(overrides: Partial<AdminSession> = {}) {
  return Object.assign(new AdminSession(), {
    id: 'session-other',
    adminUser: Object.assign(new AdminUser(), { id: userId, username: 'admin' }),
    deviceLabel: 'macOS · Safari',
    loginAt: new Date('2026-10-17T08:00:00.000Z'),
    createdAt: new Date('2026-10-17T08:00:00.000Z'),
    lastRefreshedAt: new Date('2026-10-18T07:00:00.000Z'),
    expiresAt: new Date('2026-10-25T07:00:00.000Z'),
    ...overrides,
  })
}

function setup(session: AdminSession | null = makeSession()) {
  const tx = {
    create: jest.fn((_entity: unknown, data: Partial<AdminSession>) => Object.assign(new AdminSession(), data)),
    findOneOrFail: jest.fn().mockResolvedValue({ id: userId }),
    count: jest.fn().mockResolvedValue(1),
    findOne: jest.fn().mockResolvedValue(session),
    find: jest.fn().mockResolvedValue([]),
    nativeUpdate: jest.fn().mockResolvedValue(1),
    flush: jest.fn().mockResolvedValue(undefined),
  }
  // 分开模拟外层与事务管理器，防止写操作意外逃逸到事务之外。
  const em = {
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    transactional: jest.fn((run: (manager: EntityManager) => Promise<unknown>) => run(tx as unknown as EntityManager)),
  }
  const service = new AuthSessionsService(em as unknown as EntityManager)
  return { service, em, tx }
}

describe('AuthSessionsService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('create', () => {
    it.each([
      ['Mozilla/5.0 (Macintosh; Intel Mac OS X) Version/18.0 Safari/605.1.15', 'macOS · Safari'],
      ['', '未知系统 · 未知客户端'],
      [undefined, '未知系统 · 未知客户端'],
    ])('只保存粗略设备信息并设置统一登录时间与过期时间：%s', (userAgent, deviceLabel) => {
      const { service, em, tx } = setup()
      const user = Object.assign(new AdminUser(), { id: userId })

      const session = service.create(tx as unknown as EntityManager, user, userAgent)

      expect(tx.create).toHaveBeenCalledTimes(1)
      expect(tx.create).toHaveBeenCalledWith(AdminSession, {
        adminUser: user,
        deviceLabel,
        loginAt: now,
        createdAt: now,
        lastRefreshedAt: now,
        expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
      })
      expect(session).toBe(tx.create.mock.results[0]!.value)
      expect(tx.flush).not.toHaveBeenCalled()
      expect(em.transactional).not.toHaveBeenCalled()
    })
  })

  describe('list', () => {
    it('只查询当前管理员的活跃会话，稳定排序并以固定大小分页', async () => {
      const { service, em } = setup()
      const current = makeSession({ id: currentId })
      const other = makeSession()
      em.findAndCount.mockResolvedValue([[current, other], 42])

      const result = await service.list(userId, currentId, 3)

      expect(em.findAndCount).toHaveBeenCalledTimes(1)
      expect(em.findAndCount).toHaveBeenCalledWith(
        AdminSession,
        { adminUser: userId, revokedAt: null, expiresAt: { $gt: now } },
        { orderBy: { lastRefreshedAt: 'desc', id: 'asc' }, offset: 40, limit: 20 },
      )
      expect(result).toEqual({
        items: [
          {
            id: currentId,
            device: 'macOS · Safari',
            loginAt: '2026-10-17T08:00:00.000Z',
            createdAt: '2026-10-17T08:00:00.000Z',
            lastRefreshedAt: '2026-10-18T07:00:00.000Z',
            expiresAt: '2026-10-25T07:00:00.000Z',
            current: true,
          },
          {
            id: other.id,
            device: 'macOS · Safari',
            loginAt: '2026-10-17T08:00:00.000Z',
            createdAt: '2026-10-17T08:00:00.000Z',
            lastRefreshedAt: '2026-10-18T07:00:00.000Z',
            expiresAt: '2026-10-25T07:00:00.000Z',
            current: false,
          },
        ],
        total: 42,
        page: 3,
        pageSize: 20,
      })
    })

    it('兼容没有登录时间的旧会话，且不额外暴露账号与撤销字段', async () => {
      const { service, em } = setup()
      em.findAndCount.mockResolvedValue([[makeSession({ loginAt: undefined })], 1])

      const result = await service.list(userId, currentId, 1)

      expect(result.items[0]).toEqual({
        id: 'session-other',
        device: 'macOS · Safari',
        loginAt: undefined,
        createdAt: '2026-10-17T08:00:00.000Z',
        lastRefreshedAt: '2026-10-18T07:00:00.000Z',
        expiresAt: '2026-10-25T07:00:00.000Z',
        current: false,
      })
      expect(em.findAndCount.mock.calls[0]![2]).toMatchObject({ offset: 0 })
    })

    it('没有活跃会话时返回空页并保留请求页码', async () => {
      const { service } = setup()

      await expect(service.list(userId, currentId, 2)).resolves.toEqual({
        items: [],
        total: 0,
        page: 2,
        pageSize: 20,
      })
    })

    it('查询失败时传播错误，不将故障转换为空列表', async () => {
      const { service, em } = setup()
      const failure = new Error('会话查询失败')
      em.findAndCount.mockRejectedValue(failure)

      await expect(service.list(userId, currentId, 1)).rejects.toBe(failure)
    })
  })

  describe('revoke', () => {
    it('按管理员、调用者校验、目标会话的顺序加锁，并只撤销目标会话未失效的令牌', async () => {
      const session = makeSession()
      const { service, em, tx } = setup(session)

      await expect(service.revoke(userId, session.id, currentId)).resolves.toEqual({ ok: true, revoked: 1 })

      expect(em.transactional).toHaveBeenCalledTimes(1)
      expect(tx.findOneOrFail).toHaveBeenCalledWith(AdminUser, { id: userId }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      expect(tx.count).toHaveBeenCalledWith(AdminSession, {
        id: currentId,
        adminUser: userId,
        revokedAt: null,
        expiresAt: { $gt: now },
      })
      expect(tx.findOne).toHaveBeenCalledWith(
        AdminSession,
        { id: session.id, adminUser: userId },
        { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
      )
      expect(tx.findOneOrFail.mock.invocationCallOrder[0]!).toBeLessThan(tx.count.mock.invocationCallOrder[0]!)
      expect(tx.count.mock.invocationCallOrder[0]!).toBeLessThan(tx.findOne.mock.invocationCallOrder[0]!)
      expect(session.revokedAt).toEqual(now)
      expect(tx.nativeUpdate).toHaveBeenCalledTimes(1)
      expect(tx.nativeUpdate).toHaveBeenCalledWith(RefreshToken, { session, revokedAt: null }, { revokedAt: now })
      expect(tx.flush).toHaveBeenCalledTimes(1)
      expect(tx.nativeUpdate.mock.invocationCallOrder[0]!).toBeLessThan(tx.flush.mock.invocationCallOrder[0]!)
    })

    it('允许撤销当前会话，在写入撤销时间前完成调用者校验', async () => {
      const session = makeSession({ id: currentId })
      const { service, tx } = setup(session)
      tx.count.mockImplementation(async () => {
        expect(session.revokedAt).toBeUndefined()
        return 1
      })

      await expect(service.revoke(userId, currentId, currentId)).resolves.toEqual({ ok: true, revoked: 1 })

      expect(session.revokedAt).toEqual(now)
      expect(tx.nativeUpdate).toHaveBeenCalledWith(RefreshToken, { session, revokedAt: null }, { revokedAt: now })
    })

    it('重复撤销保持第一次撤销时间，并返回零个新增撤销', async () => {
      const session = makeSession()
      const { service, tx } = setup(session)

      await expect(service.revoke(userId, session.id, currentId)).resolves.toEqual({ ok: true, revoked: 1 })
      jest.setSystemTime(new Date(now.getTime() + 60_000))
      await expect(service.revoke(userId, session.id, currentId)).resolves.toEqual({ ok: true, revoked: 0 })

      expect(session.revokedAt).toEqual(now)
      expect(tx.nativeUpdate).toHaveBeenNthCalledWith(2, RefreshToken, { session, revokedAt: null }, { revokedAt: now })
    })

    it('内部调用省略调用者时仍按账号归属锁定目标会话', async () => {
      const session = makeSession()
      const { service, tx } = setup(session)

      await expect(service.revoke(userId, session.id)).resolves.toEqual({ ok: true, revoked: 1 })

      expect(tx.count).not.toHaveBeenCalled()
      expect(tx.findOne).toHaveBeenCalledWith(
        AdminSession,
        { id: session.id, adminUser: userId },
        { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
      )
      expect(tx.findOneOrFail.mock.invocationCallOrder[0]!).toBeLessThan(tx.findOne.mock.invocationCallOrder[0]!)
    })

    it('调用者不存在、已撤销、已过期或不属该账号时拒绝操作，不读取目标', async () => {
      const { service, tx } = setup()
      tx.count.mockResolvedValue(0)

      await expect(service.revoke(userId, 'session-other', currentId)).rejects.toThrow(
        new UnauthorizedException('当前会话已失效'),
      )

      expect(tx.count).toHaveBeenCalledWith(AdminSession, {
        id: currentId,
        adminUser: userId,
        revokedAt: null,
        expiresAt: { $gt: now },
      })
      expect(tx.findOne).not.toHaveBeenCalled()
      expect(tx.nativeUpdate).not.toHaveBeenCalled()
      expect(tx.flush).not.toHaveBeenCalled()
    })

    it('目标不存在或不属当前管理员时返回统一的不存在错误', async () => {
      const { service, tx } = setup(null)

      await expect(service.revoke(userId, 'foreign-or-missing', currentId)).rejects.toThrow(
        new NotFoundException('会话不存在'),
      )

      expect(tx.findOne).toHaveBeenCalledWith(
        AdminSession,
        { id: 'foreign-or-missing', adminUser: userId },
        { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
      )
      expect(tx.nativeUpdate).not.toHaveBeenCalled()
      expect(tx.flush).not.toHaveBeenCalled()
    })

    it('管理员加锁失败时停止会话查询及写入', async () => {
      const { service, tx } = setup()
      const failure = new Error('管理员不存在')
      tx.findOneOrFail.mockRejectedValue(failure)

      await expect(service.revoke(userId, 'session-other', currentId)).rejects.toBe(failure)

      expect(tx.count).not.toHaveBeenCalled()
      expect(tx.findOne).not.toHaveBeenCalled()
      expect(tx.nativeUpdate).not.toHaveBeenCalled()
      expect(tx.flush).not.toHaveBeenCalled()
    })

    it('令牌撤销失败时不继续刷新实体，也不返回成功', async () => {
      const { service, tx } = setup()
      const failure = new Error('令牌撤销失败')
      tx.nativeUpdate.mockRejectedValue(failure)

      await expect(service.revoke(userId, 'session-other', currentId)).rejects.toBe(failure)

      expect(tx.flush).not.toHaveBeenCalled()
    })

    it('实体写入失败时传播错误，不返回撤销成功', async () => {
      const { service, tx } = setup()
      const failure = new Error('会话写入失败')
      tx.flush.mockRejectedValue(failure)

      await expect(service.revoke(userId, 'session-other', currentId)).rejects.toBe(failure)
    })
  })

  describe('revokeOthers', () => {
    it('锁定账号并确认当前会话有效，只批量撤销查询命中的其他活跃会话及其令牌', async () => {
      const { service, em, tx } = setup()
      tx.find.mockResolvedValue([makeSession({ id: 'other-1' }), makeSession({ id: 'other-2' })])

      await expect(service.revokeOthers(userId, currentId)).resolves.toEqual({ ok: true, revoked: 2 })

      expect(em.transactional).toHaveBeenCalledTimes(1)
      expect(tx.findOneOrFail).toHaveBeenCalledWith(AdminUser, { id: userId }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      expect(tx.count).toHaveBeenCalledWith(AdminSession, {
        id: currentId,
        adminUser: userId,
        revokedAt: null,
        expiresAt: { $gt: now },
      })
      expect(tx.find).toHaveBeenCalledWith(AdminSession, {
        adminUser: userId,
        id: { $ne: currentId },
        revokedAt: null,
        expiresAt: { $gt: now },
      })
      expect(tx.findOneOrFail.mock.invocationCallOrder[0]!).toBeLessThan(tx.count.mock.invocationCallOrder[0]!)
      expect(tx.count.mock.invocationCallOrder[0]!).toBeLessThan(tx.find.mock.invocationCallOrder[0]!)
      expect(tx.nativeUpdate).toHaveBeenCalledTimes(2)
      expect(tx.nativeUpdate).toHaveBeenNthCalledWith(
        1,
        AdminSession,
        { id: { $in: ['other-1', 'other-2'] } },
        { revokedAt: now },
      )
      expect(tx.nativeUpdate).toHaveBeenNthCalledWith(
        2,
        RefreshToken,
        { session: { $in: ['other-1', 'other-2'] }, revokedAt: null },
        { revokedAt: now },
      )
    })

    it('没有其他活跃会话时返回零，避免空条件批量更新', async () => {
      const { service, tx } = setup()

      await expect(service.revokeOthers(userId, currentId)).resolves.toEqual({ ok: true, revoked: 0 })

      expect(tx.count).toHaveBeenCalledTimes(1)
      expect(tx.find).toHaveBeenCalledTimes(1)
      expect(tx.nativeUpdate).not.toHaveBeenCalled()
    })

    it('重复撤销时再次查询活跃范围，已撤销会话不重复计数', async () => {
      const { service, tx } = setup()
      tx.find.mockResolvedValueOnce([makeSession()]).mockResolvedValueOnce([])

      await expect(service.revokeOthers(userId, currentId)).resolves.toEqual({ ok: true, revoked: 1 })
      await expect(service.revokeOthers(userId, currentId)).resolves.toEqual({ ok: true, revoked: 0 })

      expect(tx.find).toHaveBeenCalledTimes(2)
      expect(tx.nativeUpdate).toHaveBeenCalledTimes(2)
    })

    it('当前会话失效时拒绝批量撤销，不查询或修改其他会话', async () => {
      const { service, tx } = setup()
      tx.count.mockResolvedValue(0)

      await expect(service.revokeOthers(userId, currentId)).rejects.toThrow(new UnauthorizedException('当前会话已失效'))

      expect(tx.find).not.toHaveBeenCalled()
      expect(tx.nativeUpdate).not.toHaveBeenCalled()
    })

    it('管理员加锁失败时不校验调用者或查询其他会话', async () => {
      const { service, tx } = setup()
      const failure = new Error('管理员加锁失败')
      tx.findOneOrFail.mockRejectedValue(failure)

      await expect(service.revokeOthers(userId, currentId)).rejects.toBe(failure)

      expect(tx.count).not.toHaveBeenCalled()
      expect(tx.find).not.toHaveBeenCalled()
      expect(tx.nativeUpdate).not.toHaveBeenCalled()
    })

    it('会话批量撤销失败时停止令牌更新并传播错误', async () => {
      const { service, tx } = setup()
      const failure = new Error('批量撤销失败')
      tx.find.mockResolvedValue([makeSession()])
      tx.nativeUpdate.mockRejectedValue(failure)

      await expect(service.revokeOthers(userId, currentId)).rejects.toBe(failure)

      expect(tx.nativeUpdate).toHaveBeenCalledTimes(1)
      expect(tx.nativeUpdate.mock.calls[0]![0]).toBe(AdminSession)
    })
  })
})
