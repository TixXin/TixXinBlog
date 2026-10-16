/** @file useSubscriptions.ts @description 公开订阅列表和全量筛选统计同步接纳，SSR 与导航查询一致 */
import type { SubscriptionQuery } from '~/features/subscription/types'
import { publicSubscriptionQuery } from '~/features/subscription/query'
export async function useSubscriptions() {
  const repo = useSubscriptionRepository(),
    route = useRoute(),
    router = useRouter(),
    scope = usePageRequestScope(),
    app = useNuxtApp()
  const ready = ref(false),
    hydrating = ref(import.meta.client && app.isHydrating)
  let initialQuery: SubscriptionQuery = publicSubscriptionQuery(route.query)
  const serverKey = (app.payload.data['subscriptions-feed'] as { key?: string } | undefined)?.key
  if (hydrating.value && serverKey) {
    try {
      initialQuery = publicSubscriptionQuery(JSON.parse(serverKey))
    } catch {
      /* 回退当前路由。 */
    }
  }
  const query = computed(() => (hydrating.value ? initialQuery : publicSubscriptionQuery(route.query)))
  const key = computed(() => JSON.stringify(query.value))
  const feed = usePublicReadData(
    'subscriptions-feed',
    async (_app, { signal }) => {
      const requested = key.value,
        current = query.value,
        ownedSignal = AbortSignal.any([scope.signal, signal])
      const [page, stats] = await Promise.all([repo.list(current, ownedSignal), repo.stats(current, ownedSignal)])
      return { key: requested, page, stats }
    },
    { domain: 'subscriptions', query: () => query.value },
  )
  const accepted = ref<NonNullable<typeof feed.data.value> | null>(null)
  watch(
    feed.data,
    (value) => {
      if (value?.key === key.value && !scope.signal.aborted) accepted.value = value
    },
    { immediate: true },
  )
  watch(key, () => {
    void feed.reload()
  })
  watch(
    feed.generation,
    () => {
      accepted.value = null
    },
    { flush: 'sync' },
  )
  onMounted(() => {
    ready.value = true
    hydrating.value = false
  })
  await feed
  scope.assertActive()
  // 成对保留最后一次成功响应；不同查询的统计和列表不进入新筛选范围。
  if (feed.data.value?.key === key.value) accepted.value = feed.data.value
  const current = computed(() => (accepted.value?.key === key.value ? accepted.value : null))
  return {
    query,
    ready,
    items: computed(() => current.value?.page.items ?? []),
    total: computed(() => current.value?.page.total ?? null),
    stats: computed(() => current.value?.stats ?? null),
    pending: feed.pending,
    error: feed.error,
    refresh: feed.refresh,
    changeQuery: (patch: Record<string, string | number | undefined>) =>
      router.push({ path: '/subscriptions', query: { ...route.query, page: undefined, ...patch } }),
  }
}
