/**
 * @file useSiteSettingsEditor.ts
 * @description 站点设置编辑、失败保留、版本冲突与历史恢复。
 */
import type { SiteSettingsData } from '~/features/site/settings'
export function useSiteSettingsEditor() {
  const api = useAdminApi()
  const auth = useCurrentUser()
  const publicSite = useSiteSettings()
  const toast = useToast()
  const draft = ref<SiteSettingsData | null>(null)
  const conflict = ref<SiteSettingsData | null>(null)
  const historical = ref<SiteSettingsData | null>(null)
  const preserved = ref<SiteSettingsData | null>(null)
  const pending = ref(false)
  const error = ref('')
  const baseline = ref('')
  const history = ref<{ revision: number; reason: string; createdAt: string }[]>([])
  const historyPage = ref(1)
  const historyTotal = ref(0)
  const historyPending = ref(false)
  const historyError = ref('')
  const dirty = computed(() => !!draft.value && JSON.stringify(draft.value) !== baseline.value)
  const clone = (value: SiteSettingsData) => structuredClone(toRaw(value))
  function accept(value: SiteSettingsData) {
    draft.value = value
    baseline.value = JSON.stringify(value)
    conflict.value = null
    publicSite.accept(clone(value))
  }
  async function load() {
    if (pending.value) return
    pending.value = true
    error.value = ''
    try {
      accept(await api<SiteSettingsData>('/admin/site'))
    } catch {
      error.value = '站点设置读取失败，请重试'
    } finally {
      pending.value = false
    }
  }
  async function loadHistory(page = historyPage.value) {
    if (historyPending.value) return
    historyPending.value = true
    historyError.value = ''
    try {
      const result = await api<{ items: typeof history.value; total: number }>('/admin/site/revisions', {
        query: { page },
      })
      history.value = result.items
      historyTotal.value = result.total
      historyPage.value = page
    } catch {
      historyError.value = '配置历史读取失败'
    } finally {
      historyPending.value = false
    }
  }
  async function write(path: string, method: 'PATCH' | 'POST', body: unknown) {
    if (pending.value) return
    pending.value = true
    error.value = ''
    try {
      accept(await api<SiteSettingsData>(path, { method, body }))
      toast.success('站点资料已生效')
      await loadHistory(1)
    } catch (cause) {
      const message = (cause as { data?: { message?: unknown } }).data?.message
      error.value = typeof message === 'string' ? message : '保存失败，当前输入仍保留'
      if ((cause as { statusCode?: number }).statusCode === 409) {
        try {
          conflict.value = await api<SiteSettingsData>('/admin/site')
        } catch {
          error.value += '；最新版本读取失败，请稍后重试'
        }
      }
    } finally {
      pending.value = false
    }
  }
  async function save() {
    if (!draft.value) return
    const { updatedAt: _updatedAt, announcementUpdatedAt: _announcementUpdatedAt, ...body } = draft.value
    await write('/admin/site', 'PATCH', body)
  }
  async function inspect(revision: number) {
    if (historyPending.value) return
    historyPending.value = true
    historyError.value = ''
    try {
      historical.value = await api<SiteSettingsData>(`/admin/site/revisions/${revision}`)
    } catch {
      historyError.value = '历史配置读取失败'
    } finally {
      historyPending.value = false
    }
  }
  function loadHistorical() {
    if (!historical.value || !draft.value || pending.value) return
    if (dirty.value) preserved.value = clone(draft.value)
    draft.value = { ...clone(historical.value), revision: draft.value.revision, updatedAt: draft.value.updatedAt }
    historical.value = null
  }
  async function restoreHistorical() {
    if (!historical.value || !draft.value || pending.value) return
    if (
      !window.confirm(
        `立即将站点公开资料恢复到版本 ${historical.value.revision}？这会生成新版本，未保存输入会先保留在当前页面。`,
      )
    )
      return
    if (dirty.value) preserved.value = clone(draft.value)
    await write(`/admin/site/revisions/${historical.value.revision}/restore`, 'POST', {
      revision: draft.value.revision,
    })
  }
  function mergeConflict() {
    if (!conflict.value || !draft.value) return
    draft.value.revision = conflict.value.revision
    conflict.value = null
    error.value = '已保留输入并采用最新版本号，请比较合并后再次保存'
  }
  function recoverPreserved() {
    if (!preserved.value || !draft.value || pending.value) return
    const current = clone(draft.value)
    draft.value = { ...preserved.value, revision: current.revision, updatedAt: current.updatedAt }
    preserved.value = current
  }
  function beforeUnload(event: BeforeUnloadEvent) {
    if (dirty.value) {
      event.preventDefault()
      event.returnValue = ''
    }
  }
  onBeforeRouteLeave(() => !pending.value && (!dirty.value || window.confirm('站点资料尚未保存，确定离开吗？')))
  onMounted(async () => {
    window.addEventListener('beforeunload', beforeUnload)
    if (await auth.restore()) {
      await load()
      await loadHistory()
    } else await navigateTo('/admin/login?next=/admin/site')
  })
  onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
  return {
    draft,
    conflict,
    historical,
    preserved,
    pending,
    error,
    dirty,
    history,
    historyPage,
    historyTotal,
    historyPending,
    historyError,
    load,
    save,
    loadHistory,
    inspect,
    loadHistorical,
    restoreHistorical,
    mergeConflict,
    recoverPreserved,
  }
}
