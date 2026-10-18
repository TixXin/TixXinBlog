/**
 * @file auth.constants.spec.ts
 * @description 鉴权配置单元测试：显式签名密钥要求与刷新 Cookie 的安全默认值。
 */
import { getAccessSecret, getRefreshCookieOptions, REFRESH_TOKEN_TTL_MS } from './auth.constants'

describe('getAccessSecret', () => {
  it.each([undefined, '', 'a'.repeat(31), `placeholder-<required>-${'a'.repeat(32)}`])(
    '拒绝缺失、过短或仍含模板占位符的密钥：%p',
    (secret) => {
      expect(() => getAccessSecret(secret)).toThrow('JWT_ACCESS_SECRET 必须显式配置至少 32 个字符的随机密钥')
    },
  )

  it.each(['a'.repeat(32), 'b'.repeat(64)])('接受满足长度要求的显式密钥且不改写内容', (secret) => {
    expect(getAccessSecret(secret)).toBe(secret)
  })
})

describe('getRefreshCookieOptions', () => {
  afterEach(() => jest.restoreAllMocks())

  it.each([
    { environment: 'development', secure: false },
    { environment: 'test', secure: false },
    { environment: 'production', secure: true },
    { environment: 'staging', secure: true },
    { environment: '', secure: true },
    { environment: undefined, secure: true },
  ])('环境 $environment 的刷新 Cookie secure=$secure，其余安全属性保持一致', ({ environment, secure }) => {
    const env = { ...process.env }
    if (environment === undefined) delete env.NODE_ENV
    else env.NODE_ENV = environment
    jest.replaceProperty(process, 'env', env)

    expect(getRefreshCookieOptions()).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/api/v1/auth',
      maxAge: REFRESH_TOKEN_TTL_MS,
    })
    expect(REFRESH_TOKEN_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000)
  })
})
