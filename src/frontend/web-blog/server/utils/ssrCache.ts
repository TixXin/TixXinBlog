/**
 * @file ssrCache.ts
 * @description 判断一次经本站代理的 API 请求是否应清空公开页面的 SSR HTML 缓存
 * @author TixXin
 * @since 2026-10-16
 */

// 只统计浏览量、点赞计数和登录态的接口不改变页面主体内容，不触发清缓存；其余写请求都视为内容变更。
const IGNORED = [/\/view$/, /\/like$/, /^\/api\/v1\/auth\//, /^\/api\/v1\/admin\/posts\/\d+\/preview-link$/]

export function shouldPurgeSsrCache(method: string, path: string): boolean {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false
  const pathname = path.split('?')[0] ?? path
  if (!pathname.startsWith('/api/v1/')) return false
  return !IGNORED.some((pattern) => pattern.test(pathname))
}

/** 逐键删除公开页面的 SSR 缓存：不同存储驱动对带前缀 clear 的语义不一致，逐键删除最可靠 */
export async function purgeSsrCache() {
  const storage = useStorage()
  // 路由规则缓存键形如 cache:nitro:routes:_:<path>:<cookie hash>.json；统一清 cache:nitro 前缀
  const keys = await storage.getKeys('cache:nitro')
  await Promise.all(keys.map((key) => storage.removeItem(key)))
  return keys.length
}
