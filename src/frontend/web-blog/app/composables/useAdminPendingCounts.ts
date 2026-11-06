/**
 * @file useAdminPendingCounts.ts
 * @description 后台导航待审数量：全局共享一份状态，合并并发读取，60 秒内切页复用；读取失败保留上次结果，从未成功时不显示徽章
 * @author TixXin
 * @since 2026-11-06
 */
import type { AdminPendingCounts } from '~/features/admin/pending'

const STALE_MS = 60_000
// 桌面侧栏与移动抽屉各挂一份导航，进程内共享在途请求；只在客户端读取
let inflight: Promise<void> | null = null

export function useAdminPendingCounts() {
  const counts = useState<AdminPendingCounts | null>('admin-pending-counts', () => null)
  const loadedAt = useState<number>('admin-pending-counts-at', () => 0)
  const auth = useCurrentUser()
  const api = useAdminApi()

  async function refresh(force = true) {
    if (import.meta.server || !auth.isLoggedIn.value) return
    if (!force && counts.value !== null && Date.now() - loadedAt.value < STALE_MS) return
    if (inflight) return inflight
    inflight = (async () => {
      try {
        counts.value = await api<AdminPendingCounts>('/admin/overview/pending')
        loadedAt.value = Date.now()
      } catch {
        // 保留上次已知数量；从未成功读取时不显示徽章
      } finally {
        inflight = null
      }
    })()
    return inflight
  }
  function clear() {
    counts.value = null
    loadedAt.value = 0
  }
  return { counts, refresh, clear }
}
