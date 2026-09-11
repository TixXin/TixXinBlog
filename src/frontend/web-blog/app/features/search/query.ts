/** @file query.ts @description 搜索地址约束，完整列表按类型分页，全部类型只提供分组预览。 */
import { searchTypes } from './types'
import type { SearchScope } from './types'
export function searchScope(value: unknown): SearchScope {
  return typeof value === 'string' && searchTypes.includes(value as Exclude<SearchScope, 'all'>)
    ? (value as SearchScope)
    : 'all'
}
export function searchPage(value: unknown): number {
  const page = typeof value === 'string' || typeof value === 'number' ? Number(value) : 1
  return Number.isInteger(page) && page >= 1 ? Math.min(page, 10000) : 1
}
export function searchLocation(query: string, type: SearchScope = 'all', page = 1) {
  return {
    path: '/search',
    query: {
      ...(query.trim() ? { q: query.trim().slice(0, 200) } : {}),
      ...(type !== 'all' ? { type } : {}),
      ...(type !== 'all' && page > 1 ? { page: String(page) } : {}),
    },
  }
}
