/**
 * @file authCookieLock.ts
 * @description 跨标签页串行处理认证 Cookie；短期标记协调跳转后仍在完成的 keepalive 请求，不保存令牌。
 *
 * 发起改写的文档可能在请求完成前卸载，来不及清除标记。标记记下发起时的版本 Cookie（后端每次改写结束都换新，
 * 不含凭据），等待方看到版本变化即知上一次改写已落地；版本未变或标记来自旧版本前端时才等到上限。
 */
const KEY = 'blog-auth-cookie-pending'
const VERSION_COOKIE = 'tixxin_rv'
const MAX_WAIT = 10500
interface PendingMutation {
  id: string
  until: number
  version?: string
}
function cookieVersion() {
  try {
    for (const part of document.cookie.split(';')) {
      const [name, ...value] = part.trim().split('=')
      if (name === VERSION_COOKIE) return value.join('=')
    }
  } catch {
    /* 无法读取 Cookie 时按版本未变处理，退回到期等待。 */
  }
  return ''
}
function pending() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null') as PendingMutation | null
    if (
      value &&
      typeof value.id === 'string' &&
      Number.isFinite(value.until) &&
      value.until > Date.now() &&
      value.until <= Date.now() + MAX_WAIT &&
      (value.version === undefined || typeof value.version === 'string')
    )
      return value
  } catch {
    /* 存储不可用时仍使用 Web Locks 和 keepalive，不读取或保存认证令牌。 */
  }
  return null
}
async function waitForPreviousMutation() {
  const deadline = Date.now() + MAX_WAIT
  while (Date.now() < deadline) {
    const value = pending()
    if (!value || (value.version !== undefined && cookieVersion() !== value.version)) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}
let localQueue: Promise<unknown> = Promise.resolve()
function serialized<T>(action: () => Promise<T>): Promise<T> {
  if (navigator.locks) return navigator.locks.request('blog-auth-cookie', action)
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
      const mutation: PendingMutation = { id, until: Date.now() + MAX_WAIT, version: cookieVersion() }
      localStorage.setItem(KEY, JSON.stringify(mutation))
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
