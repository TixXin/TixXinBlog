/**
 * @file auth-sessions.service.ts
 * @description 管理员自己的活跃会话与撤销；所有写操作按管理员→会话的固定顺序加锁。
 */
import { EntityManager } from '@mikro-orm/postgresql'
import { LockMode } from '@mikro-orm/core'
import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { AdminUser } from '../../entities/admin-user.entity'
import { AdminSession } from '../../entities/admin-session.entity'
import { RefreshToken } from '../../entities/refresh-token.entity'
import { REFRESH_TOKEN_TTL_MS } from './auth.constants'
import { sessionDeviceLabel } from './session-device'
@Injectable()
export class AuthSessionsService {
  constructor(private readonly em: EntityManager) {}
  create(em: EntityManager, user: AdminUser, userAgent?: string) {
    const now = new Date()
    return em.create(AdminSession, {
      adminUser: user,
      deviceLabel: sessionDeviceLabel(userAgent),
      loginAt: now,
      createdAt: now,
      lastRefreshedAt: now,
      expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
    })
  }
  async list(userId: string, current: string, page: number) {
    const [items, total] = await this.em.findAndCount(
      AdminSession,
      { adminUser: userId, revokedAt: null, expiresAt: { $gt: new Date() } },
      { orderBy: { lastRefreshedAt: 'desc', id: 'asc' }, offset: (page - 1) * 20, limit: 20 },
    )
    return {
      items: items.map((item) => ({
        id: item.id,
        device: item.deviceLabel,
        loginAt: item.loginAt?.toISOString(),
        createdAt: item.createdAt.toISOString(),
        lastRefreshedAt: item.lastRefreshedAt.toISOString(),
        expiresAt: item.expiresAt.toISOString(),
        current: item.id === current,
      })),
      total,
      page,
      pageSize: 20,
    }
  }
  private async assertCaller(em: EntityManager, userId: string, sessionId: string) {
    if (
      !(await em.count(AdminSession, {
        id: sessionId,
        adminUser: userId,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      }))
    )
      throw new UnauthorizedException('当前会话已失效')
  }
  async revoke(userId: string, sessionId: string, caller?: string) {
    return this.em.transactional(async (em) => {
      await em.findOneOrFail(AdminUser, { id: userId }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      if (caller) await this.assertCaller(em, userId, caller)
      const session = await em.findOne(
        AdminSession,
        { id: sessionId, adminUser: userId },
        { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
      )
      if (!session) throw new NotFoundException('会话不存在')
      const revoked = session.revokedAt ? 0 : 1
      session.revokedAt ??= new Date()
      await em.nativeUpdate(RefreshToken, { session, revokedAt: null }, { revokedAt: session.revokedAt })
      await em.flush()
      return { ok: true, revoked }
    })
  }
  async revokeOthers(userId: string, current: string) {
    return this.em.transactional(async (em) => {
      await em.findOneOrFail(AdminUser, { id: userId }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      await this.assertCaller(em, userId, current)
      const now = new Date()
      const sessions = await em.find(AdminSession, {
        adminUser: userId,
        id: { $ne: current },
        revokedAt: null,
        expiresAt: { $gt: now },
      })
      const ids = sessions.map((session) => session.id)
      if (ids.length) {
        await em.nativeUpdate(AdminSession, { id: { $in: ids } }, { revokedAt: now })
        await em.nativeUpdate(RefreshToken, { session: { $in: ids }, revokedAt: null }, { revokedAt: now })
      }
      return { ok: true, revoked: ids.length }
    })
  }
}
