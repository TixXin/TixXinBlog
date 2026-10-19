/** @file useLinkSiteInfo.ts @description 本站资料的真实来源、SSR首帧、重读与剪贴板反馈 */
import { linkSiteInfo, siteInfoText } from '~/features/link/siteInfo'
import type { SiteInfo } from '~/features/link/types'
export function useLinkSiteInfo() {
  const site = useSiteSettings(),
    app = useNuxtApp(),
    siteUrl = String(useRuntimeConfig().public.siteUrl),
    t = currentTranslate()
  const liveInfo = computed(() => linkSiteInfo(site.settings.value, site.available.value, siteUrl, t))
  const liveError = computed(() =>
    !site.available.value
      ? site.error.value || t('interaction.siteInfo.unavailable')
      : liveInfo.value
        ? ''
        : t('interaction.siteInfo.configInvalid'),
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
    retainedText.value = siteInfoText(info.value, t)
    try {
      await navigator.clipboard.writeText(retainedText.value)
      if (alive) notice.value = t('interaction.siteInfo.copied')
    } catch {
      if (alive) copyError.value = t('interaction.siteInfo.copyFailed')
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
