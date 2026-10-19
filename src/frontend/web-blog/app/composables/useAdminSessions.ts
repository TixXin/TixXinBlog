/**
 * @file useAdminSessions.ts
 * @description 读取和撤销真实会话，只有服务端确认后更新界面。
 */
import type { AdminSessionItem } from '~/features/auth/sessionTypes'
export function useAdminSessions() {
  const api = useAdminApi()
  const auth = useCurrentUser()
  const toast = useToast()
  const t = currentTranslate()
  const items = ref<AdminSessionItem[]>([])
  const page = ref(1)
  const total = ref(0)
  const pending = ref(false)
  const error = ref('')
  async function load(currentPage = page.value) {
    if (pending.value) return
    pending.value = true
    error.value = ''
    try {
      const result = await api<{ items: AdminSessionItem[]; total: number }>('/auth/sessions', {
        query: { page: currentPage },
      })
      items.value = result.items
      total.value = result.total
      page.value = currentPage
    } catch {
      error.value = t('admin-system.sessions.loadFailed')
    } finally {
      pending.value = false
    }
  }
  async function revoke(item: AdminSessionItem) {
    if (pending.value) return
    if (
      !window.confirm(
        item.current
          ? t('admin-system.sessions.confirmRevokeCurrent')
          : t('admin-system.sessions.confirmRevoke', { device: item.device }),
      )
    )
      return
    pending.value = true
    error.value = ''
    try {
      const result = await api<{ current: boolean }>(`/auth/sessions/${item.id}`, { method: 'DELETE' })
      if (result.current) {
        await auth.clearSession()
        await navigateTo('/admin/login')
        return
      }
      toast.success(t('admin-system.sessions.revoked'))
    } catch {
      error.value = t('admin-system.sessions.revokeUncertain')
    } finally {
      pending.value = false
    }
    if (!error.value) await load(1)
  }
  async function revokeOthers() {
    if (pending.value || total.value <= 1) return
    if (!window.confirm(t('admin-system.sessions.confirmRevokeOthers', { count: total.value }))) return
    pending.value = true
    error.value = ''
    try {
      const result = await api<{ revoked: number }>('/auth/sessions/revoke-others', { method: 'POST' })
      toast.success(t('admin-system.sessions.revokedOthers', { count: result.revoked }))
    } catch {
      error.value = t('admin-system.sessions.revokeOthersUncertain')
    } finally {
      pending.value = false
    }
    if (!error.value) await load(1)
  }
  return { items, page, total, pending, error, load, revoke, revokeOthers }
}
