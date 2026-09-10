/** @file query.ts @description 友链 URL 查询只规范分页与推荐枚举，不改写用户站点 URL 的路径或参数 */
import type { LinkQuery } from './types'
export function linkQuery(query: Record<string, unknown>): LinkQuery {
  const page = Number(query.page)
  return {
    q: typeof query.q === 'string' ? query.q.slice(0, 200).trim() || undefined : undefined,
    featured: query.featured === 'true' || query.featured === 'false' ? query.featured : undefined,
    page: Number.isInteger(page) && page >= 1 && page <= 10000 ? page : 1,
    pageSize: 12,
  }
}
