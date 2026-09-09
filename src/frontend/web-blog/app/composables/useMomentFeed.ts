/** @file useMomentFeed.ts @description 服务端分页的连续动态流，保留旧内容、恢复 URL 前缀并取消旧筛选读取 */
import type { MomentItem, MomentPage, MomentQuery } from '~/features/moment/types'

export async function useMomentFeed(options: {
  page: Ref<number>
  topic: Ref<string | null>
  date: Ref<string | null>
  q: Ref<string>
}) {
  const repo = useMomentRepository()
  const store = useMomentStore()
  const scope = usePageRequestScope()
  const ids = ref<string[]>([]),
    total = ref(0)
  const chunks = new Map<number, MomentItem[]>()
  let acceptedGeneration = store.generation.value
  const scopeKey = computed(() =>
    JSON.stringify({ topic: options.topic.value, date: options.date.value, q: options.q.value }),
  )
  const requestedScope = ref(scopeKey.value),
    scheduled = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  onScopeDispose(() => {
    if (timer) clearTimeout(timer)
  })
  watch(scopeKey, () => chunks.clear(), { flush: 'sync' })
  type FeedResult = MomentPage & {
    scope: string
    started: number
    generation: number
    personalized: boolean
    fresh: MomentItem[]
    chunks: { page: number; items: MomentItem[] }[]
  }
  const result = useAsyncData('moment-feed', async (_app, { signal }): Promise<FeedResult> => {
    const query: MomentQuery = {
      page: options.page.value,
      pageSize: 15,
      topic: options.topic.value || undefined,
      date: options.date.value || undefined,
      q: options.q.value || undefined,
    }
    const currentScope = scopeKey.value,
      started = store.clock.value
    const generation = store.generation.value
    if (generation !== acceptedGeneration) chunks.clear()
    const fresh: MomentItem[] = []
    requestedScope.value = currentScope
    const pages = new Map([...chunks].filter(([page]) => page <= query.page))
    let count: number | null = pages.size ? total.value : null
    for (let page = 1; page <= query.page; page++) {
      if (count !== null && page > Math.max(1, Math.ceil(count / 15))) break
      if (pages.has(page) && page !== query.page) continue
      const data = await repo.list({ ...query, page }, AbortSignal.any([signal, scope.signal]))
      count = data.total
      pages.set(page, data.items)
      fresh.push(...data.items)
    }
    return {
      page: query.page,
      pageSize: 15,
      total: count ?? 0,
      scope: currentScope,
      started,
      generation,
      personalized: import.meta.client,
      fresh,
      items: [...pages].sort(([a], [b]) => a - b).flatMap(([, items]) => items),
      chunks: [...pages].map(([page, items]) => ({ page, items })),
    }
  })
  function accept(value: FeedResult | undefined) {
    if (
      !value ||
      value.scope !== scopeKey.value ||
      value.page !== options.page.value ||
      value.generation !== store.generation.value
    )
      return
    // 历史页只提供条目顺序，不能用其中旧的互动值覆盖已确认的新状态。
    store.accept(value.fresh, value.started, value.generation)
    acceptedGeneration = value.generation
    ids.value = [...new Set(value.items.map((item) => item.id))]
    total.value = value.total
    chunks.clear()
    value.chunks.forEach((chunk) => chunks.set(chunk.page, chunk.items))
  }
  watch(result.data, accept, { immediate: true })
  watch(
    [scopeKey, options.page],
    ([_current, page], [previous, previousPage]) => {
      if (timer) clearTimeout(timer)
      const before = JSON.parse(previous) as { q: string; topic: string | null; date: string | null }
      const onlySearch =
        before.q !== options.q.value &&
        before.topic === options.topic.value &&
        before.date === options.date.value &&
        page === previousPage
      scheduled.value = onlySearch
      if (onlySearch)
        timer = setTimeout(() => {
          scheduled.value = false
          void result.refresh({ dedupe: 'cancel' })
        }, 250)
      else {
        scheduled.value = false
        void result.refresh({ dedupe: 'cancel' })
      }
    },
    { flush: 'sync' },
  )
  // SSR 公开缓存没有浏览器访客头；仅首次水合补取一次个人点赞状态。
  onMounted(() => {
    if (result.data.value && !result.data.value.personalized) {
      chunks.clear()
      void result.refresh({ dedupe: 'cancel', cachedData: undefined })
    }
  })
  await result
  if (
    result.data.value &&
    (result.data.value.scope !== scopeKey.value ||
      result.data.value.page !== options.page.value ||
      result.data.value.generation !== store.generation.value)
  )
    await result.refresh({ dedupe: 'cancel' })
  scope.assertActive()
  accept(result.data.value)
  return {
    moments: computed(() =>
      ids.value.map((id) => store.entries.value[id]).filter((item): item is MomentItem => !!item),
    ),
    total,
    pending: computed(() => scheduled.value || result.pending.value),
    error: computed(() => (requestedScope.value === scopeKey.value ? result.error.value : undefined)),
    refresh: () => {
      chunks.clear()
      return result.refresh({ dedupe: 'cancel' })
    },
  }
}
