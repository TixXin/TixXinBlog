/**
 * @file auth-origin.guard.spec.ts
 * @description 认证来源守卫：缺少 Origin、同源、白名单与非法来源的边界
 */
import { ForbiddenException } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import type { ExecutionContext } from '@nestjs/common'
import { AuthOriginGuard } from '../auth-origin.guard'

function guard(allowed = '') {
  return new AuthOriginGuard({
    get: <T>(_key: string, fallback?: T) => (allowed || fallback) as T,
  } as unknown as ConfigService)
}

function context(origin?: string, host = 'blog.example.com') {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: { origin, host } }) }),
  } as unknown as ExecutionContext
}

describe('AuthOriginGuard', () => {
  it('没有 Origin 的导航请求放行', () => {
    expect(guard().canActivate(context())).toBe(true)
  })

  it('同 Host 的 Origin 放行', () => {
    expect(guard().canActivate(context('https://blog.example.com'))).toBe(true)
  })

  it('CORS_ORIGIN 白名单逐项 trim 后放行', () => {
    expect(guard('https://a.example, https://b.example').canActivate(context('https://b.example'))).toBe(true)
  })

  it('非白名单 Origin 拒绝', () => {
    expect(() => guard('https://a.example').canActivate(context('https://evil.example'))).toThrow(ForbiddenException)
  })

  it('非法 Origin 字符串拒绝', () => {
    expect(() => guard().canActivate(context('not-a-url'))).toThrow(ForbiddenException)
  })

  it('端口不同的同域名 Origin 拒绝', () => {
    expect(() => guard().canActivate(context('https://blog.example.com:8443'))).toThrow(ForbiddenException)
  })

  it('显式端口与 Host 一致时放行', () => {
    expect(guard().canActivate(context('https://blog.example.com:8443', 'blog.example.com:8443'))).toBe(true)
  })

  it.each(['null', 'https://blog.example.com.evil.example', 'https://evil.blog.example.com'])(
    '不透明或相似域名来源不得获得同源权限：%s',
    (origin) => {
      expect(() => guard().canActivate(context(origin))).toThrow(ForbiddenException)
    },
  )

  it('通配符配置不能放行任意认证来源', () => {
    expect(() => guard('*').canActivate(context('https://evil.example'))).toThrow(ForbiddenException)
  })
})
