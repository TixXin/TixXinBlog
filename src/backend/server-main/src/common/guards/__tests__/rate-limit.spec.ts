/**
 * @file rate-limit.spec.ts
 * @description 限流回归：窗口配额、独立客户端和过期恢复
 */
import { ConfigService } from '@nestjs/config'
import type { ExecutionContext } from '@nestjs/common'
import { RateLimitGuard, RateLimitStore, SETUP_RATE_LIMIT, rateLimitClientKey } from '../rate-limit.guard'

describe('RateLimitStore', () => {
  it('突发请求超过配额时给出重试时间，过期后恢复', () => {
    const store = new RateLimitStore()
    expect(store.consume('login:ip-a', 2, 60000, 0)).toBe(0)
    expect(store.consume('login:ip-a', 2, 60000, 1)).toBe(0)
    expect(store.consume('login:ip-a', 2, 60000, 2)).toBe(60)
    expect(store.consume('login:ip-b', 2, 60000, 3)).toBe(0)
    expect(store.consume('login:ip-a', 2, 60000, 60001)).toBe(0)
  })

  it('表满时优先清理过期条目，仍满则淘汰最早窗口，新客户端不被一律拒绝', () => {
    const store = new RateLimitStore(3)
    expect(store.consume('read:a', 1, 1000, 0)).toBe(0)
    expect(store.consume('read:b', 1, 60000, 1)).toBe(0)
    expect(store.consume('read:c', 1, 60000, 2)).toBe(0)
    // a 已过期，被清理后 d 入表，b、c 的计数保持
    expect(store.consume('read:d', 1, 60000, 1500)).toBe(0)
    expect(store.size).toBe(3)
    expect(store.consume('read:b', 1, 60000, 1600)).toBeGreaterThan(0)
    // 全部未过期时淘汰最早开启的 b
    expect(store.consume('read:e', 1, 60000, 1700)).toBe(0)
    expect(store.size).toBe(3)
    expect(store.consume('read:c', 1, 60000, 1800)).toBeGreaterThan(0)
    expect(store.consume('read:b', 1, 60000, 1900)).toBe(0)
  })
})

describe('rateLimitClientKey', () => {
  it('IPv6 按 /64 归并，IPv4 与映射地址按单地址计数', () => {
    expect(rateLimitClientKey('2001:db8:1:2:3:4:5:6')).toBe('2001:db8:1:2::/64')
    expect(rateLimitClientKey('2001:DB8:0001:0002:ffff::1')).toBe('2001:db8:1:2::/64')
    expect(rateLimitClientKey('2001:db8:1:3::1')).toBe('2001:db8:1:3::/64')
    expect(rateLimitClientKey('192.0.2.1')).toBe('192.0.2.1')
    expect(rateLimitClientKey('::ffff:192.0.2.1')).toBe('192.0.2.1')
    expect(rateLimitClientKey('::ffff:c000:201')).not.toBe(rateLimitClientKey('::ffff:c000:202'))
    expect(rateLimitClientKey('::1')).toBe('0:0:0:0:0:0:0:1')
    expect(rateLimitClientKey(undefined)).toBe('unknown')
  })
})

describe('RateLimitGuard', () => {
  // 配额测试独立于机器负载；固定窗口只在专门的过期用例中显式推进。
  beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(0))
  afterEach(() => jest.restoreAllMocks())

  function createClientErrorProbe(config = { NODE_ENV: 'production', RATE_LIMIT_DISABLED: 'true' }) {
    const guard = new RateLimitGuard(new ConfigService(config))
    return (ip = '192.0.2.1', path = '/api/v1/client-errors') =>
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ path, method: 'POST', ip, socket: {} }),
          getResponse: () => ({ setHeader: () => undefined }),
        }),
      } as unknown as ExecutionContext)
  }

  it('客户端错误按 IPv6 /64 限制五次且与公开互动写入配额独立，生产不能关闭', () => {
    const request = createClientErrorProbe()
    for (let index = 0; index < 5; index++) expect(request(`2001:db8:1:2::${index + 1}`)).toBe(true)
    expect(() => request('2001:db8:1:2::99')).toThrow('操作过于频繁')
    expect(request('2001:db8:1:3::1')).toBe(true)
    for (let index = 0; index < 10; index++) expect(request('2001:db8:1:2::1', '/api/v1/guestbook')).toBe(true)
    expect(() => request('2001:db8:1:2::1', '/api/v1/guestbook')).toThrow('操作过于频繁')
  })

  it('初始化向导提交按 IP 每 10 分钟 5 次，独立于普通写入与登录，生产不能关闭', () => {
    const request = createClientErrorProbe()
    for (let index = 0; index < SETUP_RATE_LIMIT; index++) expect(request('192.0.2.7', '/api/v1/setup')).toBe(true)
    expect(() => request('192.0.2.7', '/api/v1/setup')).toThrow('操作过于频繁')
    expect(request('192.0.2.8', '/api/v1/setup')).toBe(true)
    expect(request('192.0.2.7', '/api/v1/guestbook')).toBe(true)
    // 普通写入窗口是 60 秒；setup 窗口 10 分钟内仍拒绝。
    jest.spyOn(Date, 'now').mockReturnValue(5 * 60000)
    expect(() => request('192.0.2.7', '/api/v1/setup')).toThrow('操作过于频繁')
    jest.spyOn(Date, 'now').mockReturnValue(10 * 60000 + 1)
    expect(request('192.0.2.7', '/api/v1/setup')).toBe(true)
  })

  it('多个客户端共享单实例每分钟 100 次上限', () => {
    const request = createClientErrorProbe()
    for (let index = 0; index < 100; index++) expect(request(`192.0.2.${index + 1}`)).toBe(true)
    expect(() => request('198.51.100.1')).toThrow('操作过于频繁')
    expect(request('198.51.100.1', '/api/v1/guestbook')).toBe(true)
  })

  it('错误上报在测试环境也保持完整一分钟窗口，过期后恢复', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(0)
    try {
      const request = createClientErrorProbe({ NODE_ENV: 'test', RATE_LIMIT_DISABLED: 'false' })
      for (let index = 0; index < 5; index++) expect(request()).toBe(true)
      now.mockReturnValue(1001)
      expect(() => request()).toThrow('操作过于频繁')
      now.mockReturnValue(60000)
      expect(request()).toBe(true)
    } finally {
      now.mockRestore()
    }
  })

  function createReadProbe() {
    const guard = new RateLimitGuard(new ConfigService({ NODE_ENV: 'production' }))
    return (path: string, method = 'GET') =>
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ path, method, ip: '192.0.2.1', socket: {} }),
          getResponse: () => ({ setHeader: () => undefined }),
        }),
      } as unknown as ExecutionContext)
  }

  function createLocalProbe(config: Record<string, string | undefined>) {
    const guard = new RateLimitGuard(new ConfigService(config))
    return () =>
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ path: '/api/v1/posts', method: 'GET', ip: '127.0.0.1', socket: {} }),
          getResponse: () => ({ setHeader: () => undefined }),
        }),
      } as unknown as ExecutionContext)
  }

  it('开发环境显式 RATE_LIMIT_DISABLED=true 时不计数，本机浏览器、SSR 与工具不会互相限住', () => {
    const request = createLocalProbe({ NODE_ENV: 'development', RATE_LIMIT_DISABLED: 'true' })
    for (let index = 0; index < 130; index++) expect(request()).toBe(true)
  })

  it.each([{ NODE_ENV: 'development' }, { NODE_ENV: 'production', RATE_LIMIT_DISABLED: 'true' }, {}])(
    '未显式关闭、生产环境或缺省环境仍执行配额：%j',
    (config) => {
      const request = createLocalProbe(config)
      for (let index = 0; index < 120; index++) expect(request()).toBe(true)
      expect(() => request()).toThrow('操作过于频繁')
    },
  )

  it('同一 IPv6 /64 内轮换地址共享配额', () => {
    const guard = new RateLimitGuard(new ConfigService({ NODE_ENV: 'production' }))
    const request = (ip: string) =>
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ path: '/api/v1/posts', method: 'POST', ip, socket: {} }),
          getResponse: () => ({ setHeader: () => undefined }),
        }),
      } as unknown as ExecutionContext)
    for (let index = 0; index < 10; index++) expect(request(`2001:db8:5:6::${index + 1}`)).toBe(true)
    expect(() => request('2001:db8:5:6:ffff::99')).toThrow('操作过于频繁')
    expect(request('2001:db8:5:7::1')).toBe(true)
  })
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

  it('精确 favicon GET/HEAD 与受管媒体共享 600 次边界，不挤占 JSON 或管理读取桶', () => {
    const request = createReadProbe()
    const favicon = `/api/v1/subscriptions/favicons/${'a'.repeat(64)}.webp`
    for (let index = 0; index < 120; index++) expect(request('/api/v1/subscriptions')).toBe(true)
    expect(() => request('/api/v1/subscriptions/stats')).toThrow('操作过于频繁')
    for (let index = 0; index < 599; index++) expect(request(favicon, index % 2 ? 'HEAD' : 'GET')).toBe(true)
    expect(request('/api/v1/media/image.webp')).toBe(true)
    expect(() => request(favicon)).toThrow('操作过于频繁')
    expect(() => request('/api/v1/media/image.webp', 'HEAD')).toThrow('操作过于频繁')
    for (let index = 0; index < 300; index++) expect(request('/api/v1/admin/subscriptions')).toBe(true)
    expect(() => request('/api/v1/admin/subscriptions')).toThrow('操作过于频繁')
  })

  it('伪似 favicon 路径仍受 120 次公开读取配额限制', () => {
    const prefix = '/api/v1/subscriptions/favicons/'
    const key = 'a'.repeat(64)
    for (const path of [
      `${prefix}${'a'.repeat(63)}.webp`,
      `${prefix}${'a'.repeat(65)}.webp`,
      `${prefix}${'A'.repeat(64)}.webp`,
      `${prefix}${key}.png`,
      `${prefix}${key}.webp/`,
      `${prefix}${key}.webp/extra`,
      `/api/v1/subscriptions/favicons-extra/${key}.webp`,
      '/api/v1/subscriptions/stats',
    ]) {
      const request = createReadProbe()
      for (let index = 0; index < 120; index++) expect(request(path)).toBe(true)
      expect(() => request(path)).toThrow('操作过于频繁')
      expect(request(`${prefix}${key}.webp`)).toBe(true)
    }
  })

  it('favicon 形状的写请求仍执行原有 10 次写入配额', () => {
    const request = createReadProbe()
    const favicon = `/api/v1/subscriptions/favicons/${'a'.repeat(64)}.webp`
    for (let index = 0; index < 10; index++) expect(request(favicon, 'POST')).toBe(true)
    expect(() => request(favicon, 'POST')).toThrow('操作过于频繁')
    expect(request(favicon, 'HEAD')).toBe(true)
    expect(request('/api/v1/subscriptions')).toBe(true)
  })
})
