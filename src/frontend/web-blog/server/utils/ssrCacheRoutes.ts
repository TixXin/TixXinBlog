/**
 * @file ssrCacheRoutes.ts
 * @description 服务端缓存 SSR HTML 的公开页面清单及其浏览器验证规则，供路由规则与 Nitro 插件共用
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

/** 生产环境在服务端缓存 60s 的公开页面；`/**` 结尾表示包含其下所有子路径 */
export const SSR_CACHED_PAGES = [
  '/',
  '/archive',
  '/moments',
  '/moments/**',
  '/projects',
  '/gallery',
  '/flash',
  '/flash/**',
  '/links',
  '/guestbook',
  '/about',
  '/prompts',
  '/subscriptions',
  '/tabs',
  '/articles/**',
  '/tags/**',
  '/categories/**',
] as const

/** 发给浏览器的缓存头：服务端缓存 60s，浏览器每次凭 ETag 验证 */
export const SSR_PAGE_BROWSER_CACHE_CONTROL = 'no-cache'

/** 判断请求路径（可带查询串）是否命中服务端缓存的公开页面 */
export function isSsrCachedPage(path: string): boolean {
  const pathname = path.split(/[?#]/)[0] || '/'
  return SSR_CACHED_PAGES.some((pattern) =>
    pattern.endsWith('/**') ? pathname.startsWith(pattern.slice(0, -2)) : pathname === pattern,
  )
}

/**
 * 让缓存页面的条件请求只凭 ETag 判断，并把发给浏览器的 Cache-Control 改为 no-cache。
 *
 * - Last-Modified 只精确到秒，h3 的 handleCacheHeaders 只要 If-Modified-Since 不早于它就回 304，
 *   即使 If-None-Match 与新 ETag 不符。写后清空缓存重新渲染的页面若与浏览器手里的旧副本在同一秒生成，
 *   刷新会拿到 304 继续显示旧内容。缓存页面一律带 ETag，按 RFC 9110 §13.1.3 忽略 If-Modified-Since。
 * - 命中缓存的条件请求，Nitro 回 304 时附 public, max-age=60，浏览器随后 60s 内不再询问服务端，
 *   写后清空缓存也传不到访客；统一改为 no-cache，内容未变仍只回 304。
 */
export function prepareSsrCachedPageRevalidation(req: IncomingMessage, res: ServerResponse) {
  delete req.headers['if-modified-since']
  const setHeader = res.setHeader.bind(res)
  res.setHeader = ((name: string, value: number | string | readonly string[]) =>
    setHeader(
      name,
      name.toLowerCase() === 'cache-control' ? SSR_PAGE_BROWSER_CACHE_CONTROL : value,
    )) as typeof res.setHeader
}
