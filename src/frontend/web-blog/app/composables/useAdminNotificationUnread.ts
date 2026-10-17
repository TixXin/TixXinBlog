/**
 * @file useAdminNotificationUnread.ts
 * @description 后台导航通知未读数：全局共享一份状态，合并并发读取，通知页已读后即时更新；读取失败不显示零值。
 */
const STALE_MS = 60_000
// 桌面与移动导航各挂一份，进程内共享在途请求；只在客户端使用，不会跨服务端请求共享。
let inflight: Promise<void> | null = null

export function useAdminNotificationUnread() {
  const unread = useState<number | null>('admin-notification-unread', () => null)
  const loadedAt = useState<number>('admin-notification-unread-at', () => 0)
  const auth = useCurrentUser()
  const api = useAdminApi()

  async function refresh(force = true) {
    if (import.meta.server || !auth.isLoggedIn.value) return
    if (!force && unread.value !== null && Date.now() - loadedAt.value < STALE_MS) return
    if (inflight) return inflight
    inflight = (async () => {
      try {
        const summary = await api<{ unread: number }>('/admin/notifications/summary')
        unread.value = summary.unread
        loadedAt.value = Date.now()
      } catch {
        // 保留上次已知数量；从未成功读取时不显示徽章。
      } finally {
        inflight = null
      }
    })()
    return inflight
  }
  /** 通知列表或已读操作已经拿到服务器未读数时直接写入，免一次额外请求 */
  function set(value: number) {
    unread.value = Math.max(0, value)
    loadedAt.value = Date.now()
  }
  return { unread, refresh, set }
}
