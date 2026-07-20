/**
 * @file auth.constants.ts
 * @description 鉴权常量与密钥读取:cookie 名、TTL、JWT secret(生产强制显式配置)
 * @author TixXin
 * @since 2026-07-20
 */

/** refresh token cookie 名（api.md §5.2） */
export const REFRESH_COOKIE_NAME = 'tixxin_rt'

/** access token 有效期(秒):15 分钟 */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60

/** refresh token 有效期(毫秒):7 天 */
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** 生产环境必须显式提供 secret;开发环境允许回退固定值以便本地起服 */
export function getAccessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_ACCESS_SECRET 未配置')
  return 'dev-only-access-secret-not-for-production'
}

export function getRefreshCookieOptions(): {
  httpOnly: boolean
  sameSite: 'lax'
  secure: boolean
  path: string
  maxAge: number
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    // 限定 cookie 只随鉴权接口发送,减少暴露面
    path: '/api/v1/auth',
    maxAge: REFRESH_TOKEN_TTL_MS,
  }
}
