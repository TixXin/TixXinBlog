/**
 * @file useSiteSettings.ts
 * @description SSR 与浏览器共享的真实站点资料；保存后可更新当前页面及后续导航。
 */
import { defaultSiteSettings } from '~/features/site/settings'
import type { SiteSettingsData } from '~/features/site/settings'
export function useSiteSettings() {
  const settings = useState<SiteSettingsData>('site-settings', () => structuredClone(defaultSiteSettings))
  const available = useState('site-settings-available', () => false)
  const error = useState('site-settings-error', () => '')
  const pageContext = useState<string>('page-content-context', () => '')
  async function refresh() {
    try {
      const response = await $fetch.raw<{ data: SiteSettingsData }>('/api/v1/site', { timeout: 10000, retry: 0 })
      if (!response._data) throw new Error('missing site data')
      settings.value = response._data.data
      if (!pageContext.value) pageContext.value = response.headers.get('x-content-context') ?? ''
      available.value = true
      error.value = ''
    } catch {
      available.value = false
      error.value = '站点资料暂时无法读取'
    }
  }
  function accept(value: SiteSettingsData) {
    settings.value = value
    available.value = true
    error.value = ''
  }
  return { settings, available, error, refresh, accept }
}
