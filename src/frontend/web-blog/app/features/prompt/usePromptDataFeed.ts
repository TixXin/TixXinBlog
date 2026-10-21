/** @file usePromptDataFeed.ts @description 提示词列表状态计算与分页越界辅助函数 */
import type { PromptQuery } from './types'

export function isPromptPageOutOfRange(
  total: number | null,
  query: PromptQuery,
  currentPending: boolean,
  currentError: string,
  currentStale: boolean,
): boolean {
  if (total === null || currentPending || currentError || currentStale) return false
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize))
  return query.page > pageCount
}
