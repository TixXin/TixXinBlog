/**
 * @file auth-tokens.ts
 * @description 鉴权令牌结构定义、哈希计算与令牌签发纯逻辑
 * @author TixXin
 * @since 2026-10-21
 */
import { createHash, randomBytes } from 'node:crypto'
import type { JwtService } from '@nestjs/jwt'
import * as argon2 from 'argon2'
import type { AdminUser } from '../../entities/admin-user.entity'
import { ACCESS_TOKEN_TTL_SECONDS } from './auth.constants'

export interface AccessTokenPayload {
  sub: string
  username: string
  version: number
  sid: string
}

/** 已轮换的刷新令牌被再次使用时的处置结果，用于事务提交后写审计。 */
export interface RefreshReuse {
  reuse: { userId: string; username: string; sessionId?: string; revokedTokens: number }
}

export interface LoginResult {
  accessToken: string
  expiresIn: number
  user: { id: string; username: string }
  /** refresh token 明文,仅用于 Set-Cookie,不进响应体 */
  refreshTokenPlain: string
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

// 进程内只计算一次，未知账号登录不再额外执行高成本哈希。
export const dummyPasswordHash = argon2.hash('non-account-timing-placeholder')

export function generateRefreshTokenPlain(): string {
  return randomBytes(48).toString('base64url')
}

export function buildLoginResult(
  jwtService: JwtService,
  user: Pick<AdminUser, 'id' | 'username' | 'sessionVersion'>,
  refreshTokenPlain: string,
  sessionId: string,
): LoginResult {
  const payload: AccessTokenPayload = {
    sub: user.id,
    username: user.username,
    version: user.sessionVersion,
    sid: sessionId,
  }
  return {
    accessToken: jwtService.sign(payload),
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    user: { id: user.id, username: user.username },
    refreshTokenPlain,
  }
}

export async function hashUserPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  })
}

export async function verifyUserPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password).catch(() => false)
}
