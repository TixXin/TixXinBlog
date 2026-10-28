/** @file staticFetch.ts @description 静态发布的取数守卫：替换浏览器的 fetch，把 /api/v1 的公开 GET 改读构建时导出的冻结接口文件；
 *   写入请求直接拒绝。Nuxt 的 $fetch 自动导入在模块加载时就捕获了实例，只有在这一层替换才能覆盖页面与各仓储的请求。 */
import { FROZEN_SOURCE_HEADER, apiRelativePath, frozenApiFile, frozenApiKey, hasTextQuery } from './frozenApi'

/** 非 JSON 接口：媒体与订阅图标由构建脚本直接导出为文件，不走冻结接口 */
const BINARY_API = /^\/(media|subscriptions\/favicons)\//

export type LoadFrozen = (key: string) => Promise<Response>
/** 列表回退：按规范键在列表全量上过滤；load 按冻结键读取对应文件 */
export type TextQueryFallback = (key: string, load: LoadFrozen) => Promise<Response>

export function staticFetchError(statusCode: number, message: string) {
  return Object.assign(new Error(message), { statusCode, status: statusCode, data: { code: statusCode, message } })
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url
  return null
}

function withSource(init: RequestInit | undefined, key: string): RequestInit {
  const headers = new Headers(init?.headers)
  headers.set(FROZEN_SOURCE_HEADER, key)
  return { ...init, headers }
}

export function createStaticFetchGuard(
  nativeFetch: typeof fetch,
  options: { apiBase: string; origin: string; fallback: TextQueryFallback },
): typeof fetch {
  return async (input, init) => {
    const url = requestUrl(input)
    if (!url) return nativeFetch(input, init)
    const relative = apiRelativePath(url, options.apiBase, options.origin)
    if (relative === null) return nativeFetch(input, init)
    const path = relative.split('?', 2)[0]!
    if (BINARY_API.test(path)) return nativeFetch(input, init)
    const method = (init?.method ?? 'GET').toUpperCase()
    // 静态站没有后端；互动入口已按部署形态隐藏，仍有写入时明确失败而不是静默成功。
    if (method !== 'GET' && method !== 'HEAD') throw staticFetchError(405, '静态站点不接受写入请求')
    // ofetch 已把查询参数序列化进地址，这里只需规范化即可与构建时的键对应。
    const key = frozenApiKey(relative)
    // 每个冻结文件带上自己的键，录制服务器据此回源，不会把列表全量写成原请求的数据。
    const load: LoadFrozen = (target) => nativeFetch(frozenApiFile(target), withSource(init, target))
    if (hasTextQuery(key)) return options.fallback(key, load)
    const response = await load(key)
    if (response.status !== 404) return response
    // 构建时未枚举到的分页或筛选组合：在列表全量上计算；没有全量数据时保留原来的 404。
    return options.fallback(key, load).catch(() => response)
  }
}
