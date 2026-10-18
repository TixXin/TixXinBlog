/**
 * @file listQuery.ts
 * @description 文章发现列表的规范查询参数，供刷新、分享和浏览器历史共同使用
 * @author TixXin
 * @since 2026-09-07
 */
export interface PostListQueryState {
  page: number
  tag: string | null
  category: string | null
  mode: 'waterfall' | 'pagination'
}
function text(value: unknown): string {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' ? first.trim() : ''
}
export function readPostListQuery(query: Record<string, unknown>): PostListQueryState {
  const page = text(query.page)
  const mode = text(query.mode)
  return {
    page: /^\d+$/.test(page) ? Math.min(10000, Math.max(1, Number(page))) : 1,
    tag: text(query.tag).slice(0, 80) || null,
    category: text(query.category).slice(0, 80) || null,
    mode: mode === 'continuous' || mode === 'waterfall' ? 'waterfall' : 'pagination',
  }
}
export function writePostListQuery(state: PostListQueryState): Record<string, string> {
  const query: Record<string, string> = {}
  if (state.page > 1) query.page = String(state.page)
  if (state.tag) query.tag = state.tag
  if (state.category) query.category = state.category
  if (state.mode === 'waterfall') query.mode = 'continuous'
  return query
}

/** 地址栏的 page 是否已是规范写法：第 1 页省略参数，其余页为不带前导零的十进制整数 */
export function isCanonicalPageParam(raw: unknown, page: number): boolean {
  return page > 1 ? raw === String(page) : raw === undefined
}
