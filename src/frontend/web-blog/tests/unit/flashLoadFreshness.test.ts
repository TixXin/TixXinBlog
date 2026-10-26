/** @file flashLoadFreshness.test.ts @description 闪念列表读取新鲜度：本地演示常驻有效，公开读取按时长、撤销、查询变化与时钟回拨失效 */
import { describe, expect, it } from 'vitest'
import { flashLoadFreshness } from '../../app/features/flash/notesFreshness'
import { FLASH_PUBLIC_FRESH_MS, FLASH_PUBLIC_STALE_MS } from '../../app/features/flash/state'

const base = { sameQuery: true, invalidated: false, shouldSeedLocally: false, age: 0, timedPublicRead: true }

describe('闪念列表读取新鲜度', () => {
  it('公开读取在新鲜期内复用，超过新鲜期但未过期时重新读取且保留旧结果', () => {
    expect(flashLoadFreshness(base)).toEqual({ fresh: true, stale: false })
    expect(flashLoadFreshness({ ...base, age: FLASH_PUBLIC_FRESH_MS })).toEqual({ fresh: false, stale: false })
    expect(flashLoadFreshness({ ...base, age: FLASH_PUBLIC_STALE_MS })).toEqual({ fresh: false, stale: false })
    expect(flashLoadFreshness({ ...base, age: FLASH_PUBLIC_STALE_MS + 1 })).toEqual({ fresh: false, stale: true })
  })

  it('查询变化、已撤销或时钟回拨时既不复用也不展示旧公开结果', () => {
    expect(flashLoadFreshness({ ...base, sameQuery: false })).toEqual({ fresh: false, stale: true })
    expect(flashLoadFreshness({ ...base, invalidated: true })).toEqual({ fresh: false, stale: true })
    expect(flashLoadFreshness({ ...base, age: -1 })).toEqual({ fresh: false, stale: true })
  })

  it('本地演示数据不按时长过期，私有读取不清空旧结果', () => {
    const local = { ...base, shouldSeedLocally: true, timedPublicRead: false, age: FLASH_PUBLIC_STALE_MS * 10 }
    expect(flashLoadFreshness(local)).toEqual({ fresh: true, stale: false })
    expect(flashLoadFreshness({ ...local, invalidated: true })).toEqual({ fresh: false, stale: false })
    expect(flashLoadFreshness({ ...base, timedPublicRead: false, sameQuery: false })).toEqual({
      fresh: false,
      stale: false,
    })
  })
})
