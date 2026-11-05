/**
 * @file useLivePresence.ts
 * @description 实时在线心跳：每个标签页约 30 秒向 /presence 发送一次，页面不可见时暂停、回到前台立即补发；
 *   首次进入页面与站内跳转后的第一次心跳带 view 计浏览，页面加载后的第一次浏览附带站外来源域名。页面关闭（pagehide）时用 sendBeacon 上报离开，
 *   从往返缓存恢复时重新上线。结果连同对应路径存共享状态，SSR 与水合首帧为 null。
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
  /** 博主访问令牌；未登录为 null。可异步：发送前可先续期快过期的令牌 */
  token: () => string | null | Promise<string | null>
  /** 测试注入 */
  fetcher?: typeof $fetch
}

/** 发送一次心跳；失败返回 null（静默忽略，保留上一次的数字，下一次心跳自动恢复） */
async function requestPresence(
  options: LivePresenceOptions,
  ids: { session: () => string; reader: () => string },
  page: { path: string; view: boolean; referrer?: string },
): Promise<LivePresence | null> {
  // 取令牌（含续期）失败时按访客心跳发送，不影响在线人数与统计
  const token = await Promise.resolve()
    .then(() => options.token())
    .catch(() => null)
  try {
    const result = await (options.fetcher ?? $fetch)<{ data: LivePresence }>(`${options.apiBase}/presence`, {
      method: 'POST',
      body: { session: ids.session(), ...page },
      headers: { 'X-Visitor-Id': ids.reader(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      timeout: 10000,
      retry: 0,
    })
    return result.data
  } catch {
    return null
  }
}

/**
 * 本次页面加载的站外来源：只取域名；没有来源记为空串（直接访问）；来自本站（刷新、站内新开）不计来源。
 * 只随页面加载后的第一次浏览上报一次，站内跳转不再携带。
 */
function landingReferrer(): string | undefined {
  try {
    if (!document.referrer) return ''
    const host = new URL(document.referrer).hostname
    return host && host !== window.location.hostname ? host : undefined
  } catch {
    return undefined
  }
}

/** 页面关闭时用 sendBeacon 上报离开；尽力而为，失败时由后端 90 秒窗口兜底 */
function sendLeave(apiBase: string, session: string) {
  const body = new Blob([JSON.stringify({ session })], { type: 'application/json' })
  try {
    navigator.sendBeacon?.(`${apiBase}/presence/leave`, body)
  } catch {
    /* 浏览器拒绝排队时忽略。 */
  }
}

/** 监听可见性与页面生命周期，返回取消监听的函数 */
function watchPage(handlers: { hidden: () => void; visible: () => void; leave: () => void }) {
  const onVisibility = () => (document.visibilityState === 'hidden' ? handlers.hidden() : handlers.visible())
  // 进入往返缓存后恢复时 persisted 为 true，需要重新上线。
  const onShow = (event: PageTransitionEvent) => {
    if (event.persisted && document.visibilityState !== 'hidden') handlers.visible()
  }
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', handlers.leave)
  window.addEventListener('pageshow', onShow)
  return () => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', handlers.leave)
    window.removeEventListener('pageshow', onShow)
  }
}

/** 会话 ID（sessionStorage）与访客统计 ID（localStorage）；存储不可用时各自退化为本次运行内的随机值 */
function presenceIds() {
  const sessionFallback = { value: '' }
  const readerFallback = { value: '' }
  return {
    session: () => storedId(() => window.sessionStorage, SESSION_KEY, sessionFallback),
    reader: () => storedId(() => window.localStorage, READER_KEY, readerFallback),
  }
}

/** 启动心跳循环，返回 { pageView, stop }；pageView 在站内跳转后调用 */
export function startLivePresence(state: Ref<LivePresence | null>, options: LivePresenceOptions) {
  const ids = presenceIds()
  let timer: ReturnType<typeof setTimeout> | null = null
  let pendingView = true
  let stopped = false
  let lastSentAt = -Infinity
  let landing = landingReferrer()

  async function send() {
    const view = pendingView
    pendingView = false
    lastSentAt = Date.now()
    const path = options.path()
    const referrer = view ? landing : undefined
    if (view) landing = undefined
    const result = await requestPresence(options, ids, { path, view, ...(referrer === undefined ? {} : { referrer }) })
    if (result && !stopped) state.value = { ...result, path }
  }

  function pause() {
    if (timer) clearTimeout(timer)
    timer = null
  }

  function schedule() {
    pause()
    if (stopped || document.visibilityState === 'hidden') return
    timer = setTimeout(() => {
      void send().finally(schedule)
    }, HEARTBEAT_MS)
  }

  const unwatch = watchPage({
    hidden: pause,
    // 回到前台与从往返缓存恢复常常接连触发，1 秒内只补发一次。
    visible: () => (Date.now() - lastSentAt < 1000 ? schedule() : void send().finally(schedule)),
    leave: () => {
      pause()
      lastSentAt = -Infinity
      sendLeave(options.apiBase, ids.session())
    },
  })
  if (document.visibilityState !== 'hidden') void send().finally(schedule)

  return {
    /** 站内跳转：下一次心跳计浏览并立即发送 */
    pageView() {
      pendingView = true
      if (document.visibilityState !== 'hidden') void send().finally(schedule)
    },
    stop() {
      stopped = true
      pause()
      unwatch()
    },
  }
}
