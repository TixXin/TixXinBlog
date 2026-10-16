/**
 * @file ssrCache.test.ts
 * @description 公开页面 SSR 缓存的清空判定：只有改变页面内容的写请求才触发
 */
import { describe, expect, it } from 'vitest'
import { shouldPurgeSsrCache } from '../../server/utils/ssrCache'

describe('shouldPurgeSsrCache', () => {
  it('内容写请求触发清空', () => {
    expect(shouldPurgeSsrCache('POST', '/api/v1/guestbook')).toBe(true)
    expect(shouldPurgeSsrCache('PATCH', '/api/v1/admin/posts/12?draft=1')).toBe(true)
    expect(shouldPurgeSsrCache('DELETE', '/api/v1/posts/12/comments/3')).toBe(true)
  })
  it('读取、计数与登录态不触发', () => {
    expect(shouldPurgeSsrCache('GET', '/api/v1/posts')).toBe(false)
    expect(shouldPurgeSsrCache('POST', '/api/v1/posts/12/view')).toBe(false)
    expect(shouldPurgeSsrCache('POST', '/api/v1/moments/9/like')).toBe(false)
    expect(shouldPurgeSsrCache('POST', '/api/v1/auth/refresh')).toBe(false)
    expect(shouldPurgeSsrCache('POST', '/other')).toBe(false)
  })
})
