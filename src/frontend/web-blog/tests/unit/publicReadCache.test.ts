/** @file publicReadCache.test.ts @description 公开缓存的查询归一、有效期、内存边界和写后响应隔离 */
import { describe, expect, it } from 'vitest'
import { createPublicReadCache, publicReadCache, publicReadKey } from '../../app/utils/publicReadCache'

describe('公开读取缓存', () => {
  it('规范化属性顺序，隔离领域、页码、排序和筛选', () => {
    expect(publicReadKey('gallery', { page: 2, q: '山' })).toBe(publicReadKey('gallery', { q: '山', page: 2 }))
    expect(publicReadKey('gallery', { page: 1 })).not.toBe(publicReadKey('gallery', { page: 2 }))
    expect(publicReadKey('gallery', { sort: 'asc' })).not.toBe(publicReadKey('gallery', { sort: 'desc' }))
    expect(publicReadKey('projects')).not.toBe(publicReadKey('gallery'))
  })
  it('有效期内直接复用，五分钟内允许旧结果，之后移除', () => {
    let now = 0
    const cache = createPublicReadCache({ now: () => now })
    cache.put('posts', 'page', [1], 0, 30_000)
    now = 29_999
    expect(cache.read('page')).toEqual({ value: [1], stale: false })
    now = 30_000
    expect(cache.read('page')?.stale).toBe(true)
    now = 300_001
    expect(cache.read('page')).toBeUndefined()
    expect(cache.size()).toEqual({ entries: 0, bytes: 0 })
  })
  it('追加快照用原始读取时刻计算两个期限，不重复扣减新鲜期或延长五分钟上限', () => {
    let now = 0
    const cache = createPublicReadCache({ now: () => now })
    cache.put('posts', 'page1', [1], 0, 30_000, 0, 0)
    now = 29_000
    cache.put('posts', 'page2', [1, 2], 0, 30_000, 0, 0)
    expect(cache.read('page2')?.stale).toBe(false)
    now = 31_000
    expect(cache.read('page2')?.stale).toBe(true)
    now = 310_000
    expect(cache.read('page2')).toBeUndefined()
  })
  it('按最近访问淘汰，并按 UTF-8 字节限制容量', () => {
    const cache = createPublicReadCache({ maxEntries: 2, maxBytes: 20 })
    cache.put('posts', 'a', '甲', 0, 30_000)
    cache.put('posts', 'b', '乙', 0, 30_000)
    cache.read('a')
    cache.put('posts', 'c', '丙', 0, 30_000)
    expect(cache.read('b')).toBeUndefined()
    expect(cache.read('a')?.value).toBe('甲')
    expect(cache.put('posts', 'large', '甲'.repeat(20), 0, 30_000)).toBe(false)
    cache.put('posts', 'd', '甲'.repeat(5), 0, 30_000)
    expect(cache.size().bytes).toBeLessThanOrEqual(20)
    expect(cache.read('a')).toBeUndefined()
  })
  it('按领域失效，拒绝写入前发起的迟到响应', () => {
    const cache = createPublicReadCache()
    let notifications = 0
    const stop = cache.subscribe('posts', () => notifications++)
    cache.put('posts', 'p', [1], 0, 30_000)
    cache.put('gallery', 'g', [2], 0, 30_000)
    cache.invalidate(['posts'])
    expect(notifications).toBe(1)
    expect(cache.read('p')).toBeUndefined()
    expect(cache.put('posts', 'p', [1], 0, 30_000)).toBe(false)
    expect(cache.read('g')?.value).toEqual([2])
    stop()
    cache.invalidate()
    expect(notifications).toBe(1)
    expect(cache.read('g')).toBeUndefined()
  })
  it('不同 Nuxt 应用不共享数据，SSR 请求也无法串用', () => {
    const first = {},
      second = {}
    publicReadCache(first).put('posts', 'p', [1], 0, 30_000)
    expect(publicReadCache(first).read('p')?.value).toEqual([1])
    expect(publicReadCache(second).read('p')).toBeUndefined()
  })
  it('公开投影的弱关联索引共同计费，不能用小投影绕过容量限制', () => {
    const cache = createPublicReadCache({ maxBytes: 100 })
    expect(cache.put('guestbook-feed', 'small-public-index', { ids: [1] }, 0, 30_000, 100)).toBe(false)
    expect(cache.size()).toEqual({ entries: 0, bytes: 0 })
    expect(cache.put('guestbook-feed', 'accepted', { ids: [1] }, 0, 30_000, 40)).toBe(true)
    expect(cache.size().bytes).toBe(new TextEncoder().encode(JSON.stringify({ ids: [1] })).byteLength + 40)
  })
})
