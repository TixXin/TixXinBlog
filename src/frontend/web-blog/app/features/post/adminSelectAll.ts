/** @file adminSelectAll.ts @description 后台文章“全选筛选结果”的分页读取与一致性校验 */
import type { AdminPostListRow } from './types'

/** 全选过程中检测到筛选结果变化：提示文案可直接展示，与读取失败区分 */
export class FilterChangedError extends Error {}

export interface FilteredPostsReadOptions {
  read: (page: number) => Promise<{ items: AdminPostListRow[]; total: number }>
  expectedTotal: number
  pageSize: number
  /** 读取期间被取消（新的全选、清空选择、换筛选）时返回 false */
  isCurrent: () => boolean
  messages: { changed: () => string; reordered: () => string }
}

function collectUnique(rows: Map<number, AdminPostListRow>, items: AdminPostListRow[], reordered: () => string) {
  for (const row of items) {
    if (rows.has(row.id)) throw new FilterChangedError(reordered())
    rows.set(row.id, row)
  }
}

/**
 * 按页读完筛选结果：总数、页内条数或顺序与预期不符时抛出 FilterChangedError；
 * 被取消时返回 null，调用方不留下半份全选结果。
 */
export async function readAllFilteredPosts(options: FilteredPostsReadOptions): Promise<AdminPostListRow[] | null> {
  const { expectedTotal, pageSize, isCurrent, messages } = options
  const rows = new Map<number, AdminPostListRow>()
  const maxReads = Math.ceil(expectedTotal / pageSize)
  for (let page = 1; page <= maxReads && rows.size < expectedTotal; page++) {
    const result = await options.read(page)
    if (!isCurrent()) return null
    if (result.total !== expectedTotal || result.items.length !== Math.min(pageSize, expectedTotal - rows.size))
      throw new FilterChangedError(messages.changed())
    collectUnique(rows, result.items, messages.reordered)
  }
  if (!isCurrent()) return null
  if (rows.size !== expectedTotal) throw new FilterChangedError(messages.changed())
  return [...rows.values()]
}
