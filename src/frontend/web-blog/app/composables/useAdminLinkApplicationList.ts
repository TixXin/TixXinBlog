/** @file useAdminLinkApplicationList.ts @description 友链申请审核列表与申请开关的读取；迟到响应不跨筛选、账号或内容库写回 */
import type { LinkApplicationPage, LinkSettings } from '~/features/link/types'
import { linkApplicationFilter, linkApplicationPage } from '~/features/link/application'
import { failureText } from '~/features/link/requestFailure'
export function useAdminLinkApplicationList() {
  const links = useLinkRepository(),
    applications = useLinkApplicationRepository(),
    auth = useCurrentUser(),
    route = useRoute(),
    router = useRouter(),
    scope = useAdminActionScope(),
    t = currentTranslate()
  const data = ref<LinkApplicationPage | null>(null),
    settings = ref<LinkSettings | null>(null),
    pending = ref(false),
    error = ref(''),
    mounted = ref(false)
  const query = computed(() => ({
    status: linkApplicationFilter(route.query.status),
    page: linkApplicationPage(route.query.page),
  }))
  const focus = computed(() => (typeof route.query.focus === 'string' ? route.query.focus : ''))
  let generation = 0
  async function load() {
    if (!mounted.value) return
    const version = ++generation,
      valid = scope.capture(),
      requested = JSON.stringify(query.value)
    const current = () => valid() && generation === version && JSON.stringify(query.value) === requested
    pending.value = true
    error.value = ''
    try {
      if (!auth.currentUser.value) throw new Error(t('admin-media.linkList.loginRequired'))
      const [page, value] = await Promise.all([applications.list(query.value), links.settings()])
      if (!current()) return
      data.value = page
      settings.value = value
    } catch (cause) {
      if (current()) error.value = failureText(cause, t('admin-media.linkApplications.loadFailed'))
    } finally {
      if (generation === version) pending.value = false
    }
  }
  function filter(patch: Record<string, string | number | undefined>) {
    return router.push({ query: { ...route.query, page: undefined, focus: undefined, ...patch } })
  }
  watch(query, () => void load())
  watch([() => auth.currentUser.value?.id, scope.context], () => {
    data.value = null
    settings.value = null
    void load()
  })
  onMounted(async () => {
    await auth.restore()
    mounted.value = true
    await load()
  })
  onScopeDispose(() => generation++)
  return { data, settings, pending, error, query, focus, filter, load }
}
