/** @file useLinkSiteInfo.ts @description 本站资料的真实来源、SSR首帧、重读与剪贴板反馈 */
import { linkSiteInfo, siteInfoText } from '~/features/link/siteInfo'
import type { SiteInfo } from '~/features/link/types'
export function useLinkSiteInfo() {
  const site = useSiteSettings(),
    app = useNuxtApp(),
    siteUrl = String(useRuntimeConfig().public.siteUrl)
  const liveInfo = computed(() => linkSiteInfo(site.settings.value, site.available.value, siteUrl))
  const liveError = computed(() =>
    !site.available.value
      ? site.error.value || '本站资料暂时不可用'
      : liveInfo.value
        ? ''
        : '本站地址或头像配置不可用，请核对站点设置',
  )
  const snapshot = useState<{ info: SiteInfo[] | null; error: string }>('links-site-info-ssr', () => ({
    info: liveInfo.value,
    error: liveError.value,
  }))
  if (import.meta.server) snapshot.value = { info: liveInfo.value, error: liveError.value }
  const hydrating = ref(import.meta.client && app.isHydrating),
    ready = ref(false),
    pending = ref(false),
    copying = ref(false),
    copyError = ref(''),
    notice = ref(''),
    retainedText = ref('')
  const info = computed(() => (hydrating.value ? snapshot.value.info : liveInfo.value)),
    error = computed(() => (hydrating.value ? snapshot.value.error : liveError.value))
  let alive = true
  async function refresh() {
    if (pending.value) return
    pending.value = true
    try {
      await site.refresh()
    } finally {
      if (alive) pending.value = false
    }
  }
  async function copy() {
    if (!ready.value || !info.value || !site.available.value || copying.value || pending.value) return
    copying.value = true
    copyError.value = ''
    notice.value = ''
    retainedText.value = siteInfoText(info.value)
    try {
      await navigator.clipboard.writeText(retainedText.value)
      if (alive) notice.value = '本站友链资料已复制'
    } catch {
      if (alive) copyError.value = '复制失败，资料已保留，可重试或手动复制。'
    } finally {
      if (alive) copying.value = false
    }
  }
  onMounted(() => {
    hydrating.value = false
    ready.value = true
  })
  onScopeDispose(() => {
    alive = false
  })
  return { info, error, ready, pending, copying, copyError, notice, retainedText, refresh, copy }
}
