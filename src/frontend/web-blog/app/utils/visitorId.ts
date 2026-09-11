/**
 * @file visitorId.ts
 * @description 设备级访客 id:生成并持久化到 localStorage,写接口经 X-Visitor-Id 头携带
 *              (后端只存 SHA-256 哈希,见 docs/archive/backend-design/api.md §5.1)
 * @author TixXin
 * @since 2026-07-20
 */

const STORAGE_KEY = 'tixxin-visitor-id'
let sessionVisitorId = ''

/** 取(或首次生成)访客 id;仅客户端可用,SSR 场景返回空串由调用方决定跳过 */
export function ensureVisitorId(): string {
  if (typeof window === 'undefined') return ''
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY)
    if (existing && /^[\x21-\x7e]{8,128}$/.test(existing)) return existing
    const next = crypto.randomUUID()
    window.localStorage.setItem(STORAGE_KEY, next)
    return next
  } catch {
    // 隐私模式禁 localStorage:退化为会话内随机 id(不持久)
    return (sessionVisitorId ||= crypto.randomUUID())
  }
}
