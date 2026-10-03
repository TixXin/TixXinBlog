/** @file query.ts @description 提示词筛选、分页与详情链接的输入边界 */
import type { PromptQuery } from './types'
export function promptQuery(query: Record<string, unknown>): PromptQuery {
  const page = Number(query.page)
  return {
    q: typeof query.q === 'string' ? query.q.slice(0, 200).trim() || undefined : undefined,
    model: typeof query.model === 'string' ? query.model.slice(0, 80).trim() || undefined : undefined,
    tag: typeof query.tag === 'string' ? query.tag.slice(0, 32).trim() || undefined : undefined,
    page: Number.isInteger(page) && page >= 1 && page <= 10000 ? page : 1,
    pageSize: 12,
  }
}
export function promptId(value: unknown): number | null {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value))
    ? Number(value)
    : null
}
