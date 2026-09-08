/**
 * @file auth.service.ts
 * @description 鉴权业务:argon2id 校验、access JWT 签发、refresh token 轮换与撤销
 * @author TixXin
 * @since 2026-07-20
 */

import { createHash, randomBytes } from 'node:crypto'
import { LockMode } from '@mikro-orm/core'
import { EntityManager } from '@mikro-orm/postgresql'
import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as argon2 from 'argon2'
import { ErrorCode } from '../../common/constants/error-codes'
import { BusinessException } from '../../common/exceptions/business.exception'
import { AdminUser } from '../../entities/admin-user.entity'
import { RefreshToken } from '../../entities/refresh-token.entity'
import { AdminSession } from '../../entities/admin-session.entity'
import { AuthSessionsService } from './auth-sessions.service'
import { isUUID } from 'class-validator'
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_MS } from './auth.constants'

export interface AccessTokenPayload {
  sub: string
  username: string
  version: number
  sid: string
}

export interface LoginResult {
  accessToken: string
  expiresIn: number
  user: { id: string; username: string }
  /** refresh token 明文,仅用于 Set-Cookie,不进响应体 */
  refreshTokenPlain: string
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

// 进程内只计算一次，未知账号登录不再额外执行高成本哈希。
const dummyPasswordHash = argon2.hash('non-account-timing-placeholder')

@Injectable()
export class AuthService {
  constructor(
    private readonly em: EntityManager,
    private readonly jwtService: JwtService,
    private readonly sessions: AuthSessionsService,
  ) {}

  async login(username: string, password: string, userAgent?: string): Promise<LoginResult> {
    const user = await this.em.findOne(AdminUser, { username })
    // 用户不存在时也走一次哈希校验,避免时序差异泄露用户名是否存在
    const hashToVerify = user?.passwordHash ?? (await dummyPasswordHash)
    const valid = await argon2.verify(hashToVerify, password).catch(() => false)
    if (!user || !valid) {
      throw new BusinessException(ErrorCode.Unauthorized, '用户名或密码错误', HttpStatus.UNAUTHORIZED)
    }

    const verifiedHash = user.passwordHash
    return this.em.transactional(async (em) => {
      const current = await em.findOne(
        AdminUser,
        { id: user.id },
        { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
      )
      if (!current || current.passwordHash !== verifiedHash)
        throw new BusinessException(ErrorCode.Unauthorized, '账号凭据已变化，请重新登录', HttpStatus.UNAUTHORIZED)
      current.lastLoginAt = new Date()
      const session = this.sessions.create(em, current, userAgent)
      const refreshTokenPlain = await this.issueRefreshToken(current, session, em)
      await em.flush()
      return this.buildLoginResult(current, refreshTokenPlain, session.id)
    })
  }

  /** 刷新:校验 cookie 中的 refresh token,轮换(旧 token 立即作废)并签发新 access */
  async refresh(refreshTokenPlain: string, userAgent?: string): Promise<LoginResult> {
    return this.em.transactional(async (em) => {
      // 与改密保持同一锁顺序：先管理员，再刷新记录，避免漏撤销或锁顺序死锁。
      const candidate = await em.findOne(RefreshToken, { tokenHash: sha256(refreshTokenPlain) })
      if (!candidate) throw new BusinessException(ErrorCode.RefreshTokenExpired, '登录已失效', HttpStatus.UNAUTHORIZED)
      const user = await em.findOne(
        AdminUser,
        { id: candidate.adminUser.id },
        { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
      )
      if (!user) throw new BusinessException(ErrorCode.Unauthorized, '账号不存在', HttpStatus.UNAUTHORIZED)
      const record = await em.findOne(
        RefreshToken,
        { tokenHash: sha256(refreshTokenPlain) },
        { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
      )
      const now = new Date()
      if (!record || record.revokedAt || record.expiresAt <= now) {
        throw new BusinessException(
          ErrorCode.RefreshTokenExpired,
          'Refresh token 失效,请重新登录',
          HttpStatus.UNAUTHORIZED,
        )
      }
      let session: AdminSession
      if (record.session) {
        const existing = await em.findOne(
          AdminSession,
          { id: record.session.id, adminUser: user },
          { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
        )
        if (!existing || existing.revokedAt || existing.expiresAt <= now)
          throw new BusinessException(
            ErrorCode.RefreshTokenExpired,
            '会话已撤销或过期，请重新登录',
            HttpStatus.UNAUTHORIZED,
          )
        session = existing
      } else {
        // 兼容迁移期间旧进程刚签发的有效刷新记录；旧登录时间未知，不伪造为此次登录。
        session = this.sessions.create(em, user, userAgent)
        session.loginAt = undefined
        record.session = session
      }
      session.lastRefreshedAt = now
      session.expiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS)
      record.revokedAt = now
      const nextPlain = await this.issueRefreshToken(user, session, em)
      await em.flush()
      return this.buildLoginResult(user, nextPlain, session.id)
    })
  }

  /** 登出撤销请求中可验证的 Cookie 与访问令牌会话；两者可能因再次登录而不同。 */
  async logout(
    refreshTokenPlain?: string,
    accessToken?: string,
  ): Promise<{ id: string; name: string; sessionId?: string; revoked: number } | undefined> {
    const targets = new Map<string, { id: string; name: string; sessionId: string }>()
    const record = refreshTokenPlain
      ? await this.em.findOne(
          RefreshToken,
          { tokenHash: sha256(refreshTokenPlain), revokedAt: null, expiresAt: { $gt: new Date() } },
          { populate: ['adminUser'] },
        )
      : null
    let actor = record
      ? { id: record.adminUser.id, name: record.adminUser.username, sessionId: record.session?.id }
      : undefined
    if (record?.session) targets.set(record.session.id, { ...actor!, sessionId: record.session.id })
    else if (record) {
      record.revokedAt = new Date()
      await this.em.flush()
    }
    if (accessToken) {
      let payload: AccessTokenPayload | undefined
      try {
        payload = await this.jwtService.verifyAsync<AccessTokenPayload>(accessToken)
      } catch {
        /* 过期或非法访问令牌不能额外授权撤销；有效 Cookie 仍可退出。 */
      }
      if (
        payload &&
        typeof payload.sid === 'string' &&
        isUUID(payload.sid) &&
        typeof payload.sub === 'string' &&
        isUUID(payload.sub)
      ) {
        const session = await this.em.findOne(
          AdminSession,
          { id: payload.sid, adminUser: payload.sub },
          { populate: ['adminUser'] },
        )
        if (session) {
          actor = { id: session.adminUser.id, name: session.adminUser.username, sessionId: session.id }
          targets.set(session.id, { ...actor, sessionId: session.id })
        }
      }
    }
    let revoked = 0
    for (const target of targets.values()) {
      const result = await this.sessions.revoke(target.id, target.sessionId)
      revoked += result.revoked
    }
    return actor ? { ...actor, revoked } : undefined
  }

  async getMe(userId: string): Promise<{ id: string; username: string; lastLoginAt?: string }> {
    const user = await this.em.findOne(AdminUser, { id: userId })
    if (!user) throw new BusinessException(ErrorCode.Unauthorized, '账号不存在', HttpStatus.UNAUTHORIZED)
    return { id: user.id, username: user.username, lastLoginAt: user.lastLoginAt?.toISOString() }
  }

  async changePassword(userId: string, version: number, currentPassword: string, newPassword: string) {
    return this.em.transactional(async (em) => {
      const user = await em.findOne(AdminUser, { id: userId }, { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true })
      if (!user || user.sessionVersion !== version)
        throw new BusinessException(ErrorCode.Unauthorized, '登录已失效，请重新登录', HttpStatus.UNAUTHORIZED)
      if (!(await argon2.verify(user.passwordHash, currentPassword).catch(() => false)))
        throw new BadRequestException('当前密码不正确')
      if (currentPassword === newPassword) throw new BadRequestException('新密码不能与当前密码相同')
      user.passwordHash = await argon2.hash(newPassword, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      })
      user.sessionVersion += 1
      await em.nativeUpdate(AdminSession, { adminUser: user, revokedAt: null }, { revokedAt: new Date() })
      await em.nativeUpdate(RefreshToken, { adminUser: user, revokedAt: null }, { revokedAt: new Date() })
      await em.flush()
      return { ok: true }
    })
  }

  async hasSession(token?: string): Promise<boolean> {
    if (!token) return false
    return !!(await this.em.findOne(RefreshToken, {
      tokenHash: sha256(token),
      revokedAt: null,
      expiresAt: { $gt: new Date() },
      $or: [{ session: null }, { session: { revokedAt: null, expiresAt: { $gt: new Date() } } }],
    }))
  }

  private async issueRefreshToken(user: AdminUser, session: AdminSession, em = this.em): Promise<string> {
    const plain = randomBytes(48).toString('base64url')
    em.create(RefreshToken, {
      adminUser: user,
      tokenHash: sha256(plain),
      session,
      expiresAt: session.expiresAt,
      createdAt: new Date(),
    })
    return plain
  }

  private buildLoginResult(user: AdminUser, refreshTokenPlain: string, sessionId: string): LoginResult {
    const payload: AccessTokenPayload = {
      sub: user.id,
      username: user.username,
      version: user.sessionVersion,
      sid: sessionId,
    }
    return {
      accessToken: this.jwtService.sign(payload),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: { id: user.id, username: user.username },
      refreshTokenPlain,
    }
  }
}
