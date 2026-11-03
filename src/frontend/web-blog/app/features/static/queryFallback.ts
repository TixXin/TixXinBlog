/**
 * @file queryFallback.ts
 * @description 静态站冻结接口的查询回退入口：文章的关键词搜索在正文索引上按后端规则匹配，
 *   其余自由文本查询与构建时未枚举到的筛选、分页组合在列表全量上计算。
 * @author TixXin
 * @since 2026-11-03
 */
import { hasTextQuery } from './frozenApi'
import { postSearchFallback } from './postSearch'
import type { LoadFrozen } from './staticFetch'
import { textQueryFallback } from './textQuery'

export function staticQueryFallback(key: string, load: LoadFrozen) {
  const path = key.split('?', 2)[0]
  return path === '/posts' && hasTextQuery(key) ? postSearchFallback(key, load) : textQueryFallback(key, load)
}
