/** @file useAdminTraffic.ts @description 后台访问统计取数：按所选范围（7/30/90 天）读取，切换范围立即重新读取 */
import type { TrafficRange, TrafficReport } from '~/features/presence/traffic'

export function useAdminTraffic() {
  const { t } = useI18n()
  const api = useAdminApi()
  const range = ref<TrafficRange>(30)
  const resource = useAdminReadResource(
    () => api<TrafficReport>('/admin/presence/traffic', { query: { days: range.value } }),
    () => t('admin-system.traffic.loadFailed'),
  )
  watch(range, () => void resource.refresh())
  return { range, ...resource }
}
