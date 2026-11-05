/**
 * @file useReleaseInfo.ts
 * @description 后台版本信息：读取本站 /api/releases.json（前端服务查询 GitHub 并缓存），只在客户端读取一次；
 *   读取失败不提示错误，版本标签照常显示当前版本
 * @author TixXin
 * @since 2026-11-06
 */
import type { ReleaseSummary } from '~/features/release/types'

export function useReleaseInfo() {
  const summary = useState<ReleaseSummary | null>('admin-release-info', () => null)
  const loading = useState('admin-release-loading', () => false)
  const failed = useState('admin-release-failed', () => false)

  async function load(force = false) {
    if (import.meta.server || loading.value || (summary.value && !force)) return
    loading.value = true
    try {
      summary.value = await $fetch<ReleaseSummary>('/api/releases.json', {
        query: force ? { refresh: '1' } : undefined,
        retry: 0,
        timeout: 15_000,
      })
      failed.value = false
    } catch {
      failed.value = true
    } finally {
      loading.value = false
    }
  }

  return { summary, loading, failed, load }
}
