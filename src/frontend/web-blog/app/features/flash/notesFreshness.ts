/** @file notesFreshness.ts @description 闪念列表读取的新鲜度判定：本地演示数据常驻有效，公开读取按时长、撤销与查询条件失效 */
import { FLASH_PUBLIC_FRESH_MS, FLASH_PUBLIC_STALE_MS } from './state'

export interface FlashLoadFreshnessInput {
  /** 已加载结果与本次查询条件相同 */
  sameQuery: boolean
  /** 写入或换身份后标记的缓存失效 */
  invalidated: boolean
  /** 本地演示仓库：数据只在本机变化，不按时长过期 */
  shouldSeedLocally: boolean
  /** 距上次读取的毫秒数；负数表示本机时钟回拨 */
  age: number
  /** 未登录且走真实接口的公开读取 */
  timedPublicRead: boolean
}

/** fresh：可直接复用已加载结果；stale：公开结果已不可展示，读取前须先清空 */
export function flashLoadFreshness(input: FlashLoadFreshnessInput): { fresh: boolean; stale: boolean } {
  const { sameQuery, invalidated, shouldSeedLocally, age, timedPublicRead } = input
  return {
    fresh: sameQuery && !invalidated && (shouldSeedLocally || (age >= 0 && age < FLASH_PUBLIC_FRESH_MS)),
    stale: timedPublicRead && (!sameQuery || invalidated || age < 0 || age > FLASH_PUBLIC_STALE_MS),
  }
}
