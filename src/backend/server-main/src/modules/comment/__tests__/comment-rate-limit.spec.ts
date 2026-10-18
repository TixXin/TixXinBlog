/**
 * @file comment-rate-limit.spec.ts
 * @description 文章评论限流回归：共享写配额、独立读取、客户端隔离与固定窗口边界
 */
import type { ExecutionContext } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RateLimitGuard } from '../../../common/guards/rate-limit.guard'

type CommentRequest = {
  path?: string
  method?: 'GET' | 'POST'
  ip?: string
  visitorId?: string
  parentId?: number
}

function createProbe(config: Record<string, string> = { NODE_ENV: 'production' }) {
  const guard = new RateLimitGuard(new ConfigService(config))
  return ({
    path = '/api/v1/posts/1/comments',
    method = 'POST',
    ip = '192.0.2.1',
    visitorId = 'visitor-a',
    parentId,
  }: CommentRequest = {}) => {
    const setHeader = jest.fn()
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          path,
          method,
          ip,
          headers: { 'x-visitor-id': visitorId },
          body: { author: '读者', content: '感谢分享这段经历', parentId },
          socket: { remoteAddress: '127.0.0.1' },
        }),
        getResponse: () => ({ setHeader }),
      }),
    } as unknown as ExecutionContext
    return { activate: () => guard.canActivate(context), setHeader }
  }
}

type RequestProbe = ReturnType<ReturnType<typeof createProbe>>

function expectAllowed(request: RequestProbe) {
  expect(request.activate()).toBe(true)
  expect(request.setHeader).not.toHaveBeenCalled()
}

function expectLimited(request: RequestProbe, retryAfter: number) {
  expect(request.activate).toThrow(expect.objectContaining({ status: 429, message: '操作过于频繁，请稍后重试' }))
  expect(request.setHeader).toHaveBeenCalledTimes(1)
  expect(request.setHeader).toHaveBeenCalledWith('Retry-After', String(retryAfter))
}

describe('文章评论公开接口限流', () => {
  const windowStart = Date.parse('2026-10-18T00:00:00.000Z')
  let now = windowStart

  beforeEach(() => {
    now = windowStart
    jest.spyOn(Date, 'now').mockImplementation(() => now)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('创建、回复与点赞共享同一 IP 的十次写配额，轮换访客或目标不能绕过', () => {
    const request = createProbe()
    for (let index = 0; index < 10; index++) {
      expectAllowed(
        request({
          path: index % 3 === 2 ? `/api/v1/comments/${index + 1}/like` : `/api/v1/posts/${index + 1}/comments`,
          parentId: index % 3 === 1 ? index + 100 : undefined,
          visitorId: `visitor-${index}`,
        }),
      )
    }
    for (const options of [
      { path: '/api/v1/posts/99/comments' },
      { path: '/api/v1/posts/100/comments', parentId: 200 },
      { path: '/api/v1/comments/999/like' },
    ]) {
      expectLimited(request({ ...options, visitorId: 'another-visitor' }), 60)
    }
  })

  it.each(['读取', '写入'] as const)('%s配额用尽后仍可使用另一类评论配额', (first) => {
    const request = createProbe()
    const scopes = [
      { name: '读取', method: 'GET', limit: 120 },
      { name: '写入', method: 'POST', limit: 10 },
    ] as const
    const ordered = first === '读取' ? scopes : [scopes[1], scopes[0]]
    for (const scope of ordered) {
      for (let index = 0; index < scope.limit; index++) {
        expectAllowed(request({ method: scope.method, path: `/api/v1/posts/${index + 1}/comments` }))
      }
      expectLimited(request({ method: scope.method }), 60)
    }
    // 后续读取或写入不会重置另一类已经耗尽的配额。
    for (const scope of scopes) expectLimited(request({ method: scope.method }), 60)
  })

  it('生产环境忽略关闭开关，重试秒数向上取整且到达一分钟边界才完整恢复', () => {
    const request = createProbe({ NODE_ENV: 'production', RATE_LIMIT_DISABLED: 'true' })
    for (let index = 0; index < 10; index++) expectAllowed(request())
    for (const [elapsed, retryAfter] of [
      [0, 60],
      [1000, 59],
      [58999, 2],
      [59000, 1],
      [59999, 1],
    ] as const) {
      now = windowStart + elapsed
      expectLimited(request({ path: '/api/v1/comments/1/like' }), retryAfter)
    }
    now = windowStart + 60000
    for (let index = 0; index < 10; index++) expectAllowed(request())
    expectLimited(request(), 60)
  })

  it('测试环境保留十次写配额，只将窗口缩短为一秒', () => {
    const request = createProbe({ NODE_ENV: 'test', RATE_LIMIT_DISABLED: 'false' })
    for (let index = 0; index < 10; index++) expectAllowed(request({ path: '/api/v1/comments/1/like' }))
    expectLimited(request(), 1)
    now = windowStart + 999
    expectLimited(request(), 1)
    now = windowStart + 1000
    for (let index = 0; index < 10; index++) expectAllowed(request())
    expectLimited(request(), 1)
  })

  it('不同解析后 IPv4 地址独立计数，不因代理连接地址或访客标识相同而合并', () => {
    const request = createProbe()
    for (let index = 0; index < 10; index++) expectAllowed(request({ ip: '192.0.2.1' }))
    expectLimited(request({ ip: '192.0.2.1' }), 60)
    for (let index = 0; index < 10; index++) {
      expectAllowed(request({ ip: '192.0.2.2', path: '/api/v1/comments/1/like' }))
    }
    expectLimited(request({ ip: '192.0.2.2' }), 60)
    expectLimited(request({ ip: '192.0.2.1' }), 60)
  })

  it('同一 IPv6 /64 内轮换地址仍共用评论写配额，其他前缀不受影响', () => {
    const request = createProbe()
    for (let index = 0; index < 10; index++) {
      expectAllowed(request({ ip: `2001:db8:5:6::${index + 1}`, visitorId: `visitor-${index}` }))
    }
    expectLimited(request({ ip: '2001:DB8:0005:0006:ffff::99', path: '/api/v1/comments/1/like' }), 60)
    expectAllowed(request({ ip: '2001:db8:5:7::1', path: '/api/v1/comments/1/like' }))
  })
})
