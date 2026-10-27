/**
 * @file useMaintenanceDiagnostics.ts
 * @description 仅管理员可读取的实际运行诊断与媒体核验结果。
 */
/** 运行诊断：数据库、迁移、媒体存储与运行环境 */
export interface MaintenanceDiagnostics {
  checkedAt: string
  databaseReachable: boolean
  pendingMigrations: number
  schemaDrift: boolean
  storage: { readable: boolean; writable: boolean; cleaned: boolean }
  mediaRecords: number
  contentContextRequired: boolean
  runtime: { node: string; nodeSupported: boolean; environment: string }
}
/** 现有媒体文件核验结果 */
export interface MaintenanceMediaCheck {
  checkedAt: string
  checked: number
  problems: { id: string; deleted: boolean; reason: string }[]
}
export function useMaintenanceDiagnostics() {
  const api = useAdminApi()
  const auth = useCurrentUser()
  const { t } = useI18n()
  const pending = ref(false)
  const error = ref('')
  const data = ref<MaintenanceDiagnostics | null>(null)
  const media = ref<MaintenanceMediaCheck | null>(null)
  async function load() {
    if (pending.value) return
    pending.value = true
    error.value = ''
    try {
      data.value = await api('/admin/maintenance/diagnostics')
    } catch {
      error.value = t('admin-system.maintenance.diagnostics.loadFailed')
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
      error.value = t('admin-system.maintenance.diagnostics.mediaFailed')
    } finally {
      pending.value = false
    }
  }
  onMounted(async () => {
    if (await auth.restore()) await load()
  })
  return { pending, error, data, media, load, checkMedia }
}
