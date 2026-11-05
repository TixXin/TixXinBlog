/** @file accessToken.test.ts @description 访问令牌本地过期判断与快过期时先续期的纯逻辑回归。 */
import { describe, expect, it, vi } from 'vitest'
import { accessTokenExpiresAt, accessTokenExpiresSoon, freshAccessToken } from '../../app/features/auth/accessToken'

/** 生成只含载荷的 JWT 形状字符串（签名不参与本地判断） */
function jwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`
}

const NOW = Date.UTC(2026, 10, 5, 12, 0, 0)

describe('访问令牌过期判断', () => {
  it('读取 base64url 载荷中的 exp，缺失或格式错误时返回 null', () => {
    expect(accessTokenExpiresAt(jwt({ sub: 'owner', exp: NOW / 1000 + 900 }))).toBe(NOW + 900_000)
    expect(accessTokenExpiresAt(jwt({ sub: 'owner' }))).toBeNull()
    expect(accessTokenExpiresAt(jwt({ exp: '900' }))).toBeNull()
    expect(accessTokenExpiresAt('not-a-jwt')).toBeNull()
    expect(accessTokenExpiresAt('a.%%%.c')).toBeNull()
  })

  it('剩余不足 60 秒或已过期视为快过期，无法解析时交给后端判定', () => {
    expect(accessTokenExpiresSoon(jwt({ exp: NOW / 1000 + 600 }), NOW)).toBe(false)
    expect(accessTokenExpiresSoon(jwt({ exp: NOW / 1000 + 60 }), NOW)).toBe(true)
    expect(accessTokenExpiresSoon(jwt({ exp: NOW / 1000 - 3600 }), NOW)).toBe(true)
    expect(accessTokenExpiresSoon('opaque', NOW)).toBe(false)
  })
})

describe('发送前取有效令牌', () => {
  it('未登录与令牌仍有效时不续期，原样返回', async () => {
    const refresh = vi.fn()
    const valid = jwt({ exp: NOW / 1000 + 600 })
    await expect(freshAccessToken(() => null, refresh, NOW)).resolves.toBeNull()
    await expect(freshAccessToken(() => valid, refresh, NOW)).resolves.toBe(valid)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('令牌已过期时先续期并返回新令牌', async () => {
    let token = jwt({ exp: NOW / 1000 - 3 * 3600 })
    const renewed = jwt({ exp: NOW / 1000 + 900 })
    const refresh = vi.fn(async () => {
      token = renewed
      return true
    })
    await expect(freshAccessToken(() => token, refresh, NOW)).resolves.toBe(renewed)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('续期失败时不再发送过期令牌，按未登录处理', async () => {
    const expired = jwt({ exp: NOW / 1000 - 60 })
    await expect(
      freshAccessToken(
        () => expired,
        async () => false,
        NOW,
      ),
    ).resolves.toBeNull()
  })
})
