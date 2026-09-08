/**
 * @file useAdminSessions.ts
 * @description 读取和撤销真实会话，只有服务端确认后更新界面。
 */
import type { AdminSessionItem } from '~/features/auth/sessionTypes'
export function useAdminSessions() {
  const api = useAdminApi()
  const auth = useCurrentUser()
  const toast = useToast()
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
      error.value = '会话列表读取失败，请重试'
    } finally {
      pending.value = false
    }
  }
  async function revoke(item: AdminSessionItem) {
    if (pending.value) return
    if (
      !window.confirm(
        item.current
          ? '撤销当前会话会立即退出并清空当前账号页输入，确定继续吗？'
          : `撤销“${item.device}”的会话？该会话之后的管理请求将被拒绝。`,
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
      toast.success('所选会话已撤销')
    } catch {
      error.value = '未能确认撤销结果，请刷新会话列表后检查'
    } finally {
      pending.value = false
    }
    if (!error.value) await load(1)
  }
  async function revokeOthers() {
    if (pending.value || total.value <= 1) return
    if (
      !window.confirm(
        `撤销当前账号的其他全部会话？当前列表共 ${total.value} 个有效会话；操作时以服务器上的其他会话为准，当前会话保留。`,
      )
    )
      return
    pending.value = true
    error.value = ''
    try {
      const result = await api<{ revoked: number }>('/auth/sessions/revoke-others', { method: 'POST' })
      toast.success(`已撤销 ${result.revoked} 个其他会话`)
    } catch {
      error.value = '未能确认撤销结果，请刷新列表后检查'
    } finally {
      pending.value = false
    }
    if (!error.value) await load(1)
  }
  return { items, page, total, pending, error, load, revoke, revokeOthers }
}
