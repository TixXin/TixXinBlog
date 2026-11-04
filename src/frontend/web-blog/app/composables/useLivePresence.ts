/**
 * @file useLivePresence.ts
 * @description 实时在线心跳：每个标签页约 30 秒向 /presence 发送一次，页面不可见时暂停、回到前台立即补发；
 *   首次进入页面与站内跳转后的第一次心跳带 view 计浏览。结果存共享状态，SSR 与水合首帧为 null。
 *   访客统计用独立的本地匿名 ID（blog-reader-id），不生成互动用的访客 ID，不改变“本设备是否有互动记录”的判断。
 */
import type { LivePresence } from '~/features/presence/types'

/** 心跳间隔；后端 90 秒内无心跳即移出在线人数 */
export const HEARTBEAT_MS = 30_000
const SESSION_KEY = 'blog-presence-session'
const READER_KEY = 'blog-reader-id'
const READER_PATTERN = /^[a-f0-9]{32}$/

export function useLivePresenceState() {
  return useState<LivePresence | null>('live-presence', () => null)
}

function randomHex(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** 读取或生成存储中的随机 ID；存储不可用（隐私模式）时退化为本次运行内的随机值 */
function storedId(storage: () => Storage, key: string, fallback: { value: string }): string {
  try {
    const existing = storage().getItem(key)
    if (existing && READER_PATTERN.test(existing)) return existing
    const next = randomHex()
    storage().setItem(key, next)
    return next
  } catch {
    return (fallback.value ||= randomHex())
  }
}

export interface LivePresenceOptions {
  apiBase: string
  /** 当前页面路径（不含查询与片段） */
  path: () => string
  /** 博主访问令牌；未登录为 null */
  token: () => string | null
  /** 测试注入 */
  fetcher?: typeof $fetch
}

/** 发送一次心跳；失败返回 null（静默忽略，保留上一次的数字，下一次心跳自动恢复） */
async function requestPresence(
  options: LivePresenceOptions,
  ids: { session: () => string; reader: () => string },
  view: boolean,
): Promise<LivePresence | null> {
  const token = options.token()
  try {
    const result = await (options.fetcher ?? $fetch)<{ data: LivePresence }>(`${options.apiBase}/presence`, {
      method: 'POST',
      body: { session: ids.session(), path: options.path(), view },
      headers: { 'X-Visitor-Id': ids.reader(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      timeout: 10000,
      retry: 0,
    })
    return result.data
  } catch {
    return null
  }
}

/** 启动心跳循环，返回 { pageView, stop }；pageView 在站内跳转后调用 */
export function startLivePresence(state: Ref<LivePresence | null>, options: LivePresenceOptions) {
  const sessionFallback = { value: '' }
  const readerFallback = { value: '' }
  const ids = {
    session: () => storedId(() => window.sessionStorage, SESSION_KEY, sessionFallback),
    reader: () => storedId(() => window.localStorage, READER_KEY, readerFallback),
  }
  let timer: ReturnType<typeof setTimeout> | null = null
  let pendingView = true
  let stopped = false

  async function send() {
    const view = pendingView
    pendingView = false
    const result = await requestPresence(options, ids, view)
    if (result && !stopped) state.value = result
  }

  function schedule() {
    if (timer) clearTimeout(timer)
    timer = null
    if (stopped || document.visibilityState === 'hidden') return
    timer = setTimeout(() => {
      void send().finally(schedule)
    }, HEARTBEAT_MS)
  }

  function onVisibility() {
    if (document.visibilityState === 'hidden') {
      if (timer) clearTimeout(timer)
      timer = null
      return
    }
    void send().finally(schedule)
  }

  document.addEventListener('visibilitychange', onVisibility)
  if (document.visibilityState !== 'hidden') void send().finally(schedule)

  return {
    /** 站内跳转：下一次心跳计浏览并立即发送 */
    pageView() {
      pendingView = true
      if (document.visibilityState !== 'hidden') void send().finally(schedule)
    },
    stop() {
      stopped = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    },
  }
}
