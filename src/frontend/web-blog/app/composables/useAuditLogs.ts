/**
 * @file useAuditLogs.ts
 * @description 审计筛选分页保持在 URL，忽略过期请求返回，读取失败保留筛选条件。
 */
import { auditStateLabels } from '~/features/audit/types'
import type { AuditItem, AuditState } from '~/features/audit/types'
export function useAuditLogs() {
  const api = useAdminApi()
  const auth = useCurrentUser()
  const route = useRoute()
  const router = useRouter()
  const items = ref<AuditItem[]>([])
  const total = ref(0)
  const page = ref(1)
  const action = ref('')
  const state = ref<AuditState | ''>('')
  const from = ref('')
  const to = ref('')
  const actions = ref<Record<string, string>>({})
  const pending = ref(false)
  const error = ref('')
  const actionsError = ref('')
  async function loadActions() {
    actionsError.value = ''
    try {
      actions.value = await api('/admin/audit/actions')
    } catch {
      actionsError.value = '操作筛选选项读取失败'
    }
  }
  const health = ref({ waitingResults: 0, retryQueue: 0, droppedRetries: 0 })
  let version = 0
  let ready = false
  function sync() {
    const text = (key: string) => (typeof route.query[key] === 'string' ? String(route.query[key]) : '')
    action.value = text('action')
    state.value = Object.hasOwn(auditStateLabels, text('state')) ? (text('state') as AuditState) : ''
    from.value = text('from')
    to.value = text('to')
    const number = Number(text('page'))
    page.value = Number.isSafeInteger(number) && number > 0 && number <= 10000 ? number : 1
  }
  async function navigate(number: number) {
    const query: Record<string, string> = {}
    if (action.value) query.action = action.value
    if (state.value) query.state = state.value
    if (from.value) query.from = from.value
    if (to.value) query.to = to.value
    if (number > 1) query.page = String(number)
    if (router.resolve({ path: '/admin/audit', query }).fullPath === route.fullPath) await load()
    else await router.push({ path: '/admin/audit', query })
  }
  async function load() {
    const current = ++version
    pending.value = true
    error.value = ''
    try {
      const result = await api<{ items: AuditItem[]; total: number; health: typeof health.value }>('/admin/audit', {
        query: {
          page: page.value,
          action: action.value || undefined,
          state: state.value || undefined,
          from: from.value || undefined,
          to: to.value || undefined,
        },
      })
      if (current !== version) return
      items.value = result.items
      total.value = result.total
      health.value = result.health
      if (page.value > Math.max(1, Math.ceil(total.value / 20)))
        await navigate(Math.max(1, Math.ceil(total.value / 20)))
    } catch {
      if (current === version) {
        items.value = []
        error.value = '审计记录读取失败，请检查登录或筛选条件后重试'
      }
    } finally {
      if (current === version) pending.value = false
    }
  }
  function clear() {
    action.value = state.value = from.value = to.value = ''
    void navigate(1)
  }
  watch(
    () => route.query,
    () => {
      sync()
      if (ready) void load()
    },
    { immediate: true },
  )
  onMounted(async () => {
    if (!(await auth.restore())) {
      await navigateTo({ path: '/admin/login', query: { next: route.fullPath } })
      return
    }
    ready = true
    await Promise.all([loadActions(), load()])
  })
  onBeforeUnmount(() => {
    version += 1
  })
  return {
    items,
    total,
    page,
    action,
    state,
    from,
    to,
    actions,
    actionsError,
    loadActions,
    pending,
    error,
    health,
    navigate,
    load,
    clear,
  }
}
