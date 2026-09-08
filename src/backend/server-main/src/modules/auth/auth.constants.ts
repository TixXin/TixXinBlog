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

/** 所有环境均显式配置密钥，不提供可预测的开发默认签名密钥。 */
export function getAccessSecret(secret?: string): string {
  if (!secret || secret.length < 32 || secret.includes('<required>')) {
    throw new Error('JWT_ACCESS_SECRET 必须显式配置至少 32 个字符的随机密钥')
  }
  return secret
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
