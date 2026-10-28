/** @file textQuery.ts @description 静态站自由文本查询：在构建时导出的列表全量上做不区分大小写的子串匹配，再按请求分页；字段范围以公开列表投影为准 */
import { TEXT_QUERY_PARAMS, frozenAllKey, frozenApiFile } from './frozenApi'
import { staticFetchError } from './staticFetch'

/** 查询接口与其全量来源不同名时的映射，例如闪念搜索取自闪念列表 */
const sourcePaths: Record<string, string> = { '/flashes/search': '/flashes' }
/** 查询参数名与列表条目字段名不一致时的映射；未列出的参数按同名字段比较 */
const fieldAliases: Record<string, string> = { featured: 'isFeatured', tag: 'tags', folder: 'folder' }
const paging = new Set(['page', 'pageSize', 'limit', 'cursor'])
/** 只影响排序或展示的参数，不参与过滤 */
const ignored = new Set(['pinnedFirst', 'sort', 'order', 'mode', 'includeArchive', 'scope'])

type Item = Record<string, unknown>

function texts(value: unknown, depth = 0): string[] {
  if (typeof value === 'string') return [value]
  if (typeof value === 'number') return [String(value)]
  if (depth > 2 || !value || typeof value !== 'object') return []
  return Object.values(value).flatMap((child) => texts(child, depth + 1))
}

function fieldMatches(item: Item, name: string, expected: string) {
  const value = item[fieldAliases[name] ?? name]
  if (value === undefined) return true
  if (Array.isArray(value))
    return value.some((entry) => texts(entry).some((text) => text.toLowerCase() === expected.toLowerCase()))
  return String(value).toLowerCase() === expected.toLowerCase()
}

/** 在条目上应用规范键中的文本与筛选参数，返回与列表接口相同形状的分页结果 */
export function filterFrozenList(key: string, items: Item[]) {
  const params = new URLSearchParams(key.split('?', 2)[1] ?? '')
  const terms = TEXT_QUERY_PARAMS.map((name) => (params.get(name) ?? '').trim().toLowerCase()).filter(Boolean)
  const filtered = items.filter(
    (item) =>
      terms.every((term) => texts(item).some((text) => text.toLowerCase().includes(term))) &&
      [...params].every(
        ([name, value]) =>
          TEXT_QUERY_PARAMS.includes(name as never) ||
          paging.has(name) ||
          ignored.has(name) ||
          fieldMatches(item, name, value),
      ),
  )
  const page = Math.max(1, Number(params.get('page')) || 1)
  const pageSize = Math.max(1, Number(params.get('pageSize') ?? params.get('limit')) || filtered.length || 1)
  return {
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize,
  }
}

export async function textQueryFallback(key: string, load: (file: string) => Promise<unknown>) {
  const path = key.split('?', 2)[0]!
  const source = sourcePaths[path] ?? path
  let envelope: { code?: number; data?: { items?: Item[] } }
  try {
    envelope = (await load(frozenApiFile(frozenAllKey(source)))) as typeof envelope
  } catch {
    throw staticFetchError(404, '静态站点没有该列表的搜索数据')
  }
  if (!Array.isArray(envelope?.data?.items)) throw staticFetchError(404, '静态站点没有该列表的搜索数据')
  return { code: 0, message: 'ok', data: filterFrozenList(key, envelope.data.items) }
}
