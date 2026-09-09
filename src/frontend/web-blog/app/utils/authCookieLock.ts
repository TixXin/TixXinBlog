/**
 * @file authCookieLock.ts
 * @description 跨标签页串行处理认证 Cookie；短期标记协调跳转后仍在完成的 keepalive 请求，不保存令牌。
 */
const KEY = 'tixxin-auth-cookie-pending'
const MAX_WAIT = 10500
function pending() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null') as { id: string; until: number } | null
    if (
      value &&
      typeof value.id === 'string' &&
      Number.isFinite(value.until) &&
      value.until > Date.now() &&
      value.until <= Date.now() + MAX_WAIT
    )
      return value
  } catch {
    /* 存储不可用时仍使用 Web Locks 和 keepalive，不读取或保存认证令牌。 */
  }
  return null
}
async function waitForPreviousMutation() {
  const deadline = Date.now() + MAX_WAIT
  while (pending() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100))
}
let localQueue: Promise<unknown> = Promise.resolve()
function serialized<T>(action: () => Promise<T>): Promise<T> {
  if (navigator.locks) return navigator.locks.request('tixxin-auth-cookie', action)
  const result = localQueue.then(action)
  localQueue = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}
export function withAuthCookieRead<T>(action: () => Promise<T>): Promise<T> {
  if (import.meta.server) return action()
  return serialized(async () => {
    await waitForPreviousMutation()
    return action()
  })
}
export function withAuthCookieLock<T>(action: () => Promise<T>): Promise<T> {
  if (import.meta.server) return action()
  return serialized(async () => {
    await waitForPreviousMutation()
    const id = crypto.randomUUID()
    try {
      localStorage.setItem(KEY, JSON.stringify({ id, until: Date.now() + MAX_WAIT }))
    } catch {
      /* 不阻断登录。 */
    }
    try {
      return await action()
    } finally {
      try {
        if (pending()?.id === id) localStorage.removeItem(KEY)
      } catch {
        /* 到期后不再等待。 */
      }
    }
  })
}
