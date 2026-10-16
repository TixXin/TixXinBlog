/**
 * @file rate-limit.spec.ts
 * @description 限流回归：窗口配额、独立客户端和过期恢复
 */
import { ConfigService } from '@nestjs/config'
import type { ExecutionContext } from '@nestjs/common'
import { RateLimitGuard, RateLimitStore } from '../rate-limit.guard'

describe('RateLimitStore', () => {
  it('突发请求超过配额时给出重试时间，过期后恢复', () => {
    const store = new RateLimitStore()
    expect(store.consume('login:ip-a', 2, 60000, 0)).toBe(0)
    expect(store.consume('login:ip-a', 2, 60000, 1)).toBe(0)
    expect(store.consume('login:ip-a', 2, 60000, 2)).toBe(60)
    expect(store.consume('login:ip-b', 2, 60000, 3)).toBe(0)
    expect(store.consume('login:ip-a', 2, 60000, 60001)).toBe(0)
  })
})

describe('RateLimitGuard', () => {
  it('公开读取、媒体和管理读取分别执行 120/600/300 配额并保持 Retry-After', () => {
    const guard = new RateLimitGuard(new ConfigService({ NODE_ENV: 'production' }))
    const headers = new Map<string, string>()
    function request(path: string, method = 'GET') {
      return guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ path, method, ip: '192.0.2.1', socket: {} }),
          getResponse: () => ({ setHeader: (key: string, value: string) => headers.set(key, value) }),
        }),
      } as unknown as ExecutionContext)
    }
    for (let index = 0; index < 120; index++) expect(request('/api/v1/posts')).toBe(true)
    expect(() => request('/api/v1/posts')).toThrow('操作过于频繁')
    for (let index = 0; index < 600; index++)
      expect(request('/api/v1/media/image.webp', index % 2 ? 'HEAD' : 'GET')).toBe(true)
    expect(() => request('/api/v1/media/image.webp')).toThrow('操作过于频繁')
    for (let index = 0; index < 300; index++) expect(request('/api/v1/admin/media')).toBe(true)
    expect(() => request('/api/v1/admin/posts')).toThrow('操作过于频繁')
    expect(Number(headers.get('Retry-After'))).toBeGreaterThan(0)
    expect(Number(headers.get('Retry-After'))).toBeLessThanOrEqual(60)
    for (let index = 0; index < 20; index++) expect(request('/api/v1/admin/media', 'POST')).toBe(true)
    expect(() => request('/api/v1/admin/media', 'POST')).toThrow('操作过于频繁')
  })
})
