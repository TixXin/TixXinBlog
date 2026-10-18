// @vitest-environment node
/**
 * @file ssrCache.test.ts
 * @description 公开页面 SSR 缓存的清空判定：只有改变页面内容的写请求才触发
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { purgeSsrCache, shouldPurgeSsrCache } from '../../server/utils/ssrCache'

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
    expect(shouldPurgeSsrCache('POST', '/api/v1/admin/posts/12/preview-link')).toBe(false)
    expect(shouldPurgeSsrCache('POST', '/other')).toBe(false)
  })

  it.each(['HEAD', 'OPTIONS'])('%s 请求不触发清空', (method) => {
    expect(shouldPurgeSsrCache(method, '/api/v1/guestbook')).toBe(false)
  })

  it('排除规则只匹配目标路径，忽略查询参数', () => {
    expect(shouldPurgeSsrCache('POST', '/api/v1/posts/12/view?source=home')).toBe(false)
    expect(shouldPurgeSsrCache('POST', '/api/v1/moments/9/like?source=home')).toBe(false)
    expect(shouldPurgeSsrCache('POST', '/api/v1/auth/logout?all=true')).toBe(false)
    expect(shouldPurgeSsrCache('PUT', '/api/v1/admin/posts/12?returnTo=/view')).toBe(true)
    expect(shouldPurgeSsrCache('POST', '/api/v1/admin/authors')).toBe(true)
    expect(shouldPurgeSsrCache('POST', '/api/v1/posts/12/preview')).toBe(true)
    expect(shouldPurgeSsrCache('POST', '/api/v10/posts')).toBe(false)
    expect(shouldPurgeSsrCache('POST', '/other?returnTo=/api/v1/posts')).toBe(false)
  })
})

describe('purgeSsrCache', () => {
  const storage = {
    getKeys: vi.fn<(prefix: string) => Promise<string[]>>(),
    removeItem: vi.fn<(key: string) => Promise<void>>(),
  }

  beforeEach(() => {
    storage.getKeys.mockReset().mockResolvedValue([])
    storage.removeItem.mockReset().mockResolvedValue(undefined)
    vi.stubGlobal('useStorage', () => storage)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('仅枚举 Nitro 缓存前缀，等待每个主题缓存删除后返回实际数量', async () => {
    const keys = ['cache:nitro:routes:_:home:nexus.json', 'cache:nitro:routes:_:home:aurora.json']
    const pending = Promise.withResolvers<undefined>()
    storage.getKeys.mockResolvedValue(keys)
    storage.removeItem.mockImplementation((key) => (key === keys[1] ? pending.promise : Promise.resolve()))
    let settled = false
    const result = purgeSsrCache().then((count) => {
      settled = true
      return count
    })
    await Promise.resolve()

    expect(storage.getKeys).toHaveBeenCalledExactlyOnceWith('cache:nitro')
    expect(storage.removeItem.mock.calls).toEqual(keys.map((key) => [key]))
    expect(settled).toBe(false)
    pending.resolve(undefined)
    await expect(result).resolves.toBe(2)
  })

  it('没有缓存时返回零且不删除其他存储内容', async () => {
    await expect(purgeSsrCache()).resolves.toBe(0)
    expect(storage.getKeys).toHaveBeenCalledExactlyOnceWith('cache:nitro')
    expect(storage.removeItem).not.toHaveBeenCalled()
  })

  it('枚举失败时传播原始错误，不开始删除', async () => {
    const failure = new Error('缓存存储暂不可读')
    storage.getKeys.mockRejectedValue(failure)

    await expect(purgeSsrCache()).rejects.toBe(failure)
    expect(storage.removeItem).not.toHaveBeenCalled()
  })

  it('删除失败时传播错误，不将部分删除报告为成功', async () => {
    const failure = new Error('缓存存储暂不可写')
    storage.getKeys.mockResolvedValue(['cache:nitro:routes:_:home:nexus.json'])
    storage.removeItem.mockRejectedValue(failure)

    await expect(purgeSsrCache()).rejects.toBe(failure)
  })

  it('客户端错误上报不清空缓存，也不豁免其他相似路径', () => {
    expect(shouldPurgeSsrCache('POST', '/api/v1/client-errors')).toBe(false)
    expect(shouldPurgeSsrCache('POST', '/api/v1/client-errors/?source=window')).toBe(false)
    expect(shouldPurgeSsrCache('POST', '/api/v1/client-errors-other')).toBe(true)
    expect(shouldPurgeSsrCache('POST', '/api/v1/client-errors/settings')).toBe(true)
  })
})
