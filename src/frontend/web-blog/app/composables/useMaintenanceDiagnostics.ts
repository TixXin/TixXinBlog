/**
 * @file useMaintenanceDiagnostics.ts
 * @description 仅管理员可读取的实际运行诊断与媒体核验结果。
 */
export function useMaintenanceDiagnostics() {
  const api = useAdminApi()
  const auth = useCurrentUser()
  const pending = ref(false)
  const error = ref('')
  const data = ref<{
    checkedAt: string
    databaseReachable: boolean
    pendingMigrations: number
    schemaDrift: boolean
    storage: { readable: boolean; writable: boolean; cleaned: boolean }
    mediaRecords: number
    contentContextRequired: boolean
    runtime: { node: string; nodeSupported: boolean; environment: string }
  } | null>(null)
  const media = ref<{
    checkedAt: string
    checked: number
    problems: { id: string; deleted: boolean; reason: string }[]
  } | null>(null)
  async function load() {
    if (pending.value) return
    pending.value = true
    error.value = ''
    try {
      data.value = await api('/admin/maintenance/diagnostics')
    } catch {
      error.value = '运行诊断读取失败，请检查登录或后端连接'
    } finally {
      pending.value = false
    }
  }
  async function checkMedia() {
    if (pending.value) return
    pending.value = true
    error.value = ''
    media.value = null
    try {
      media.value = await api('/admin/maintenance/media-check', { method: 'POST', timeout: 120000 })
    } catch {
      error.value = '媒体核验未能完成，请稍后重试'
    } finally {
      pending.value = false
    }
  }
  onMounted(async () => {
    if (await auth.restore()) await load()
  })
  return { pending, error, data, media, load, checkMedia }
}
