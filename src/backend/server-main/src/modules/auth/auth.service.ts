/**
 * @file auth.service.ts
 * @description 鉴权业务:argon2id 校验、access JWT 签发、refresh token 轮换与撤销
 * @author TixXin
 * @since 2026-07-20
 */

import { createHash, randomBytes } from 'node:crypto'
import { EntityManager } from '@mikro-orm/postgresql'
import { HttpStatus, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as argon2 from 'argon2'
import { ErrorCode } from '../../common/constants/error-codes'
import { BusinessException } from '../../common/exceptions/business.exception'
import { AdminUser } from '../../entities/admin-user.entity'
import { RefreshToken } from '../../entities/refresh-token.entity'
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_MS } from './auth.constants'

export interface AccessTokenPayload {
  sub: string
  username: string
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

@Injectable()
export class AuthService {
  constructor(
    private readonly em: EntityManager,
    private readonly jwtService: JwtService,
  ) {}

  async login(username: string, password: string, userAgent?: string): Promise<LoginResult> {
    const user = await this.em.findOne(AdminUser, { username })
    // 用户不存在时也走一次哈希校验,避免时序差异泄露用户名是否存在
    const hashToVerify = user?.passwordHash ?? (await argon2.hash('timing-equalizer'))
    const valid = await argon2.verify(hashToVerify, password).catch(() => false)
    if (!user || !valid) {
      throw new BusinessException(ErrorCode.Unauthorized, '用户名或密码错误', HttpStatus.UNAUTHORIZED)
    }

    user.lastLoginAt = new Date()
    const refreshTokenPlain = await this.issueRefreshToken(user, userAgent)
    await this.em.flush()

    return this.buildLoginResult(user, refreshTokenPlain)
  }

  /** 刷新:校验 cookie 中的 refresh token,轮换(旧 token 立即作废)并签发新 access */
  async refresh(refreshTokenPlain: string, userAgent?: string): Promise<LoginResult> {
    const record = await this.em.findOne(
      RefreshToken,
      { tokenHash: sha256(refreshTokenPlain) },
      { populate: ['adminUser'] },
    )
    const now = new Date()
    if (!record || record.revokedAt || record.expiresAt < now) {
      throw new BusinessException(
        ErrorCode.RefreshTokenExpired,
        'Refresh token 失效,请重新登录',
        HttpStatus.UNAUTHORIZED,
      )
    }

    record.revokedAt = now
    const nextPlain = await this.issueRefreshToken(record.adminUser, userAgent)
    await this.em.flush()

    return this.buildLoginResult(record.adminUser, nextPlain)
  }

  /** 登出:撤销当前 refresh token(access token 短时效,到期自然失效) */
  async logout(refreshTokenPlain?: string): Promise<void> {
    if (!refreshTokenPlain) return
    const record = await this.em.findOne(RefreshToken, { tokenHash: sha256(refreshTokenPlain) })
    if (record && !record.revokedAt) {
      record.revokedAt = new Date()
      await this.em.flush()
    }
  }

  async getMe(userId: string): Promise<{ id: string; username: string; lastLoginAt?: string }> {
    const user = await this.em.findOne(AdminUser, { id: userId })
    if (!user) throw new BusinessException(ErrorCode.Unauthorized, '账号不存在', HttpStatus.UNAUTHORIZED)
    return { id: user.id, username: user.username, lastLoginAt: user.lastLoginAt?.toISOString() }
  }

  private async issueRefreshToken(user: AdminUser, userAgent?: string): Promise<string> {
    const plain = randomBytes(48).toString('base64url')
    this.em.create(RefreshToken, {
      adminUser: user,
      tokenHash: sha256(plain),
      userAgent,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      createdAt: new Date(),
    })
    return plain
  }

  private buildLoginResult(user: AdminUser, refreshTokenPlain: string): LoginResult {
    const payload: AccessTokenPayload = { sub: user.id, username: user.username }
    return {
      accessToken: this.jwtService.sign(payload),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: { id: user.id, username: user.username },
      refreshTokenPlain,
    }
  }
}
