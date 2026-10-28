/** @file staticFetch.ts @description 静态发布的取数包装：公开 GET 改读冻结接口文件，写入请求直接拒绝；不在静态形态时不安装 */
import {
  FROZEN_SOURCE_HEADER,
  apiRelativePath,
  frozenApiFile,
  frozenApiKey,
  hasTextQuery,
  type FrozenQuery,
} from './frozenApi'

export interface StaticFetchOptions {
  method?: string
  query?: FrozenQuery
  params?: FrozenQuery
  headers?: HeadersInit
  baseURL?: string
  [option: string]: unknown
}
type Call = (request: string, options?: StaticFetchOptions) => Promise<unknown>
export type BaseFetch = Call & { raw: Call; native: unknown; create: (defaults: unknown) => BaseFetch }
/** 自由文本查询的回退：按规范键在列表全量上过滤，load 读取冻结文件 */
export type TextQueryFallback = (key: string, load: (file: string) => Promise<unknown>) => Promise<unknown>

/** 与后端错误信封一致的状态码，供仓储按 4xx/5xx 分流文案 */
export function staticFetchError(statusCode: number, message: string) {
  return Object.assign(new Error(message), { statusCode, status: statusCode, data: { code: statusCode, message } })
}

export function createStaticFetch(
  base: BaseFetch,
  options: { apiBase: string; origin: string; fallback: TextQueryFallback },
): BaseFetch {
  function rewrite(request: string, init: StaticFetchOptions = {}) {
    if (typeof request !== 'string') return null
    const relative = apiRelativePath(request, options.apiBase, options.origin)
    if (relative === null) return null
    const method = (init.method ?? 'GET').toUpperCase()
    // 静态站没有后端；互动入口已按部署形态隐藏，仍有写入时明确失败而不是静默成功。
    if (method !== 'GET' && method !== 'HEAD') throw staticFetchError(405, '静态站点不接受写入请求')
    const key = frozenApiKey(relative, init.query, init.params)
    const headers = new Headers(init.headers)
    headers.set(FROZEN_SOURCE_HEADER, key)
    const forwarded: StaticFetchOptions = { ...init, method: 'GET', query: undefined, params: undefined, headers }
    delete forwarded.baseURL
    return { key, forwarded }
  }
  function wrap(call: Call): Call {
    return async (request, init) => {
      const target = rewrite(request, init)
      if (!target) return call(request, init)
      const load = (file: string) => base(file, target.forwarded)
      if (hasTextQuery(target.key)) return options.fallback(target.key, load)
      return call(frozenApiFile(target.key), target.forwarded)
    }
  }
  const wrapped = wrap(base) as BaseFetch
  wrapped.raw = wrap(base.raw)
  wrapped.native = base.native
  wrapped.create = (defaults) => createStaticFetch(base.create(defaults), options)
  return wrapped
}
