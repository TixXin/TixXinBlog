/** @file frozenApi.ts @description 静态发布的冻结接口：把公开 GET 请求规范化为稳定键，再映射到构建时导出的 JSON 文件；构建脚本与浏览器共用同一规则 */

/** 构建产物中冻结接口文件所在目录 */
export const FROZEN_API_DIRECTORY = '/_api'
/** 录制服务器据此回源真实接口；静态托管会忽略该请求头 */
export const FROZEN_SOURCE_HEADER = 'x-static-source'
/** 无法枚举的自由文本查询参数，静态站在列表全量上过滤 */
export const TEXT_QUERY_PARAMS = ['q', 'search', 'keyword'] as const

type QueryValue = string | number | boolean | null | undefined | readonly (string | number | boolean)[]
export type FrozenQuery = Record<string, QueryValue>

function canonicalPath(path: string) {
  return path
    .split('/')
    .map((segment) => {
      try {
        return encodeURIComponent(decodeURIComponent(segment))
      } catch {
        return encodeURIComponent(segment)
      }
    })
    .join('/')
}

/** 合并地址中的查询串与请求选项中的查询对象，去掉空值后按键和值排序 */
function canonicalQuery(search: string, ...queries: (FrozenQuery | undefined)[]) {
  const entries: [string, string][] = [...new URLSearchParams(search)]
  for (const query of queries)
    for (const [name, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null) continue
      for (const item of Array.isArray(value) ? value : [value]) entries.push([name, String(item)])
    }
  entries.sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : x > y ? 1 : 0) : a < b ? -1 : 1))
  return new URLSearchParams(entries).toString()
}

/**
 * 接口路径（不含 /api/v1 前缀）与查询的规范键，例如 `/posts?page=2&pageSize=15`。
 * 路径分段统一为 encodeURIComponent 形式，中文标签无论调用方是否编码都得到同一个键。
 */
export function frozenApiKey(path: string, ...queries: (FrozenQuery | undefined)[]) {
  const [pathname = '', search = ''] = path.split('?', 2)
  const query = canonicalQuery(search, ...queries)
  return canonicalPath(pathname) + (query ? `?${query}` : '')
}

/** 列表全量的键：构建时逐页取尽，供自由文本查询在客户端过滤 */
export function frozenAllKey(path: string) {
  return `${frozenApiKey(path)}#all`
}

/** cyrb53：稳定、无依赖的 53 位字符串哈希，构建时另行检查碰撞 */
function hash(value: string) {
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/** 冻结接口键对应的产物地址 */
export function frozenApiFile(key: string) {
  return `${FROZEN_API_DIRECTORY}/${hash(key)}.json`
}

/** 请求是否带有非空的自由文本查询 */
export function hasTextQuery(key: string) {
  const search = key.split('?', 2)[1] ?? ''
  const params = new URLSearchParams(search)
  return TEXT_QUERY_PARAMS.some((name) => (params.get(name) ?? '').trim() !== '')
}

/**
 * 从完整请求地址中取出相对接口基址的路径；不属于该基址时返回 null。
 * 基址可以是 `/api/v1` 这样的同源路径，也可以是绝对地址。
 */
export function apiRelativePath(request: string, apiBase: string, origin: string) {
  let url: URL, base: URL
  try {
    url = new URL(request, origin)
    base = new URL(apiBase.replace(/\/?$/, '/'), origin)
  } catch {
    return null
  }
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return null
  return '/' + url.pathname.slice(base.pathname.length) + url.search
}
