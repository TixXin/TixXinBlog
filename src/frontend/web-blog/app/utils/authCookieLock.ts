/**
 * @file authCookieLock.ts
 * @description 支持 Web Locks 的浏览器跨标签页串行修改认证 Cookie，避免并发刷新误使另一页退出。
 */
export function withAuthCookieLock<T>(action: () => Promise<T>): Promise<T> {
  if (import.meta.client && navigator.locks) return navigator.locks.request('tixxin-auth-cookie', action)
  return action()
}
