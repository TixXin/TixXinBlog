/**
 * @file accessToken.ts
 * @description 访问令牌的本地过期判断：只读取 JWT 载荷中的 exp，不校验签名（校验由后端负责）；
 *              供不经过认证拦截的请求（如实时在线心跳）在发送前决定是否先续期
 * @author TixXin
 * @since 2026-11-05
 */

/** 默认提前量：剩余有效期不足 60 秒即视为快过期，留出续期与网络往返的时间 */
export const ACCESS_TOKEN_REFRESH_MARGIN_MS = 60_000

/** 读取 JWT 的过期时间（毫秒）；格式不对或没有 exp 时返回 null */
export function accessTokenExpiresAt(token: string): number | null {
  const payload = token.split('.')[1]
  if (!payload) return null
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
    const text = new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)))
    const json = JSON.parse(text) as { exp?: unknown }
    return typeof json.exp === 'number' && Number.isFinite(json.exp) ? json.exp * 1000 : null
  } catch {
    return null
  }
}

/**
 * 取一个仍有效的访问令牌：快过期时先续期，续期成功返回新令牌，失败返回 null（按未登录处理）；
 * 未登录或令牌仍有效时原样返回
 */
export async function freshAccessToken(
  read: () => string | null,
  refresh: () => Promise<boolean>,
  now = Date.now(),
): Promise<string | null> {
  const token = read()
  if (!token || !accessTokenExpiresSoon(token, now)) return token
  return (await refresh()) ? read() : null
}

/** 令牌已过期或即将过期；无法解析时返回 false，原样发送，由后端判定 */
export function accessTokenExpiresSoon(token: string, now: number, marginMs = ACCESS_TOKEN_REFRESH_MARGIN_MS): boolean {
  const expiresAt = accessTokenExpiresAt(token)
  return expiresAt !== null && expiresAt - now <= marginMs
}
