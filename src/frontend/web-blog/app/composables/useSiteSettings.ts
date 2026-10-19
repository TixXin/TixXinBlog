/**
 * @file useSiteSettings.ts
 * @description SSR 与浏览器共享的真实站点资料；保存后可更新当前页面及后续导航。
 */
import { defaultSiteSettings } from '~/features/site/settings'
import type { SiteSettingsData } from '~/features/site/settings'
// 每个 Nuxt 应用的进行中读取；并发调用共享同一请求，等待方也能拿到真实结果。
const inflight = new WeakMap<object, Promise<void>>()
export function useSiteSettings() {
  const nuxtApp = useNuxtApp()
  const settings = useState<SiteSettingsData>('site-settings', () => structuredClone(defaultSiteSettings))
  const available = useState('site-settings-available', () => false)
  const error = useState('site-settings-error', () => '')
  const pending = useState('site-settings-pending', () => false)
  const pageContext = useState<string>('page-content-context', () => '')
  function refresh() {
    const running = inflight.get(nuxtApp)
    if (running) return running
    const task = load().finally(() => inflight.delete(nuxtApp))
    inflight.set(nuxtApp, task)
    return task
  }
  async function load() {
    pending.value = true
    try {
      const response = await $fetch.raw<{ data: SiteSettingsData }>('/api/v1/site', { timeout: 10000, retry: 0 })
      if (!response._data) throw new Error('missing site data')
      settings.value = response._data.data
      if (!pageContext.value) pageContext.value = response.headers.get('x-content-context') ?? ''
      available.value = true
      error.value = ''
    } catch {
      available.value = false
      error.value = nuxtApp.$i18n.t('layout.site.loadFailed')
    } finally {
      pending.value = false
    }
  }
  function accept(value: SiteSettingsData) {
    settings.value = value
    available.value = true
    error.value = ''
  }
  return { settings, available, error, pending, refresh, accept }
}
