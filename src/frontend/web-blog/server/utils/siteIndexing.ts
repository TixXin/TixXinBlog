/**
 * @file siteIndexing.ts
 * @description 博主“允许搜索引擎收录本站”开关的服务端读取：短时缓存、并发合并，写后由清缓存插件立即失效
 * @author TixXin
 * @since 2026-10-20
 */
import type { H3Event } from 'h3'
import { publicSiteSettings } from './publicContent'

/** 缓存时长与公开页面 SSR 缓存一致；不经本站代理的写入最多延迟这么久生效 */
export const SITE_INDEXING_TTL_MS = 60_000
/** 读取失败后的重试间隔，避免后端不可用时每个请求都等待超时 */
export const SITE_INDEXING_RETRY_MS = 5_000

/** 站点设置接口的收录开关：旧后端不返回该字段，等同于一直允许收录 */
export function searchIndexingOf(settings: { searchIndexing?: unknown } | null | undefined): boolean {
  return settings?.searchIndexing !== false
}

/** 不需要收录判断的请求：接口转发、构建产物、模块调试与图片处理路由 */
export function skipsSiteIndexing(path: string): boolean {
  const pathname = path.split(/[?#]/)[0] ?? path
  return /^\/(?:api\/|_nuxt\/|_ipx\/|_i18n\/|__)/.test(pathname)
}

/**
 * 创建收录开关读取器。读取失败时沿用最近一次成功的值；从未成功时按允许收录处理，
 * 与模块缺省行为一致——后端不可用时页面本身也无法正常渲染。
 */
export function createSiteIndexingLookup<C>(
  fetchValue: (context: C) => Promise<boolean>,
  options: { now?: () => number; ttlMs?: number; retryMs?: number } = {},
) {
  const now = options.now ?? Date.now
  const ttlMs = options.ttlMs ?? SITE_INDEXING_TTL_MS
  const retryMs = options.retryMs ?? SITE_INDEXING_RETRY_MS
  let known: boolean | undefined
  let expiresAt = 0
  let generation = 0
  let pending: Promise<boolean> | null = null
  /** context 只传给本次实际发起的读取，不被缓存持有 */
  async function get(context: C): Promise<boolean> {
    // 成功后的缓存期与失败后的重试间隔内都不再请求；从未成功时按允许收录
    if (now() < expiresAt) return known ?? true
    if (pending) return pending
    const started = generation
    const request: Promise<boolean> = fetchValue(context)
      .then((value) => {
        // 读取期间发生过写入：结果可能是写入前的旧值，只返回给本次调用方，不进入缓存
        if (started === generation) {
          known = value
          expiresAt = now() + ttlMs
        }
        return value
      })
      .catch(() => {
        if (started === generation) expiresAt = now() + retryMs
        return known ?? true
      })
      .finally(() => {
        if (pending === request) pending = null
      })
    pending = request
    return request
  }
  /** 站点设置可能已变更：下次读取重新请求，失败时仍可沿用旧值 */
  function invalidate() {
    expiresAt = 0
    generation += 1
    pending = null
  }
  return { get, invalidate }
}

const lookup = createSiteIndexingLookup(async (event: H3Event) => searchIndexingOf(await publicSiteSettings(event)))

/** 读取当前站点是否允许搜索引擎收录；事件只用于取运行时配置，公开接口不携带访客 Cookie */
export function siteSearchIndexing(event: H3Event): Promise<boolean> {
  return lookup.get(event)
}

/** 内容写入后与 SSR 页面缓存一起失效 */
export function invalidateSiteSearchIndexing() {
  lookup.invalidate()
}
