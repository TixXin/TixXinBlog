/**
 * @file rate-limit.spec.ts
 * @description 限流回归：窗口配额、独立客户端和过期恢复
 */
import { RateLimitStore } from '../rate-limit.guard'

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
