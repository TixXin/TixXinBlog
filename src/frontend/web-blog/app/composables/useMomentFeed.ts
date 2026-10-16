/** @file useMomentFeed.ts @description 连续动态流只缓存公开编号快照，实体与个人互动继续由原仓储接纳 */
import type { MomentItem, MomentQuery } from '~/features/moment/types'

export async function useMomentFeed(options: {
  page: Ref<number>
  topic: Ref<string | null>
  date: Ref<string | null>
  q: Ref<string>
}) {
  const repo = useMomentRepository(),
    store = useMomentStore(),
    scope = usePageRequestScope()
  const ids = ref<string[]>([]),
    total = ref(0)
  const chunks = new Map<number, string[]>()
  let acceptedPage = 0,
    acceptedScope = '',
    prefixReadAt = 0
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
  interface FeedResult {
    page: number
    pageSize: number
    total: number
    scope: string
    generation: number
    prefixReadAt: number
    ids: string[]
    chunks: { page: number; ids: string[] }[]
  }
  const result = usePublicReadData(
    'moment-feed',
    async (_app, { signal }): Promise<FeedResult> => {
      const query: MomentQuery = {
        page: options.page.value,
        pageSize: 15,
        topic: options.topic.value || undefined,
        date: options.date.value || undefined,
        q: options.q.value || undefined,
      }
      const currentScope = scopeKey.value,
        started = store.clock.value,
        generation = store.generation.value,
        now = Date.now()
      const ownedSignal = AbortSignal.any([signal, scope.signal])
      const appending =
        currentScope === acceptedScope &&
        query.page === acceptedPage + 1 &&
        acceptedPage > 0 &&
        now - prefixReadAt < 30_000 &&
        Array.from({ length: acceptedPage }, (_, index) => index + 1).every((page) => chunks.has(page))
      const pages = appending ? new Map(chunks) : new Map<number, string[]>()
      const fresh: MomentItem[] = []
      let count: number | null = pages.size ? total.value : null
      requestedScope.value = currentScope
      for (let page = 1; page <= query.page; page++) {
        if (ownedSignal.aborted) throw new DOMException('动态读取已取消', 'AbortError')
        if (count !== null && page > Math.max(1, Math.ceil(count / 15))) break
        if (pages.has(page) && page !== query.page) continue
        const data = await repo.list({ ...query, page }, ownedSignal)
        count = data.total
        pages.set(
          page,
          data.items.map((item) => item.id),
        )
        fresh.push(...data.items)
      }
      // 实体不进入页缓存；取消或代次变化时也不能先写回原实体仓储。
      if (ownedSignal.aborted || generation !== store.generation.value)
        throw new DOMException('动态读取已失效', 'AbortError')
      store.accept(fresh, started, generation)
      if (import.meta.client)
        store.markPersonalized(
          fresh.map((item) => item.id),
          generation,
        )
      return {
        page: query.page,
        pageSize: 15,
        total: count ?? 0,
        scope: currentScope,
        generation,
        prefixReadAt: appending ? prefixReadAt : now,
        ids: [...pages].sort(([a], [b]) => a - b).flatMap(([, items]) => items),
        chunks: [...pages].map(([page, ids]) => ({ page, ids })),
      }
    },
    {
      domain: 'moment-feed',
      query: () => ({ scope: scopeKey.value, page: options.page.value }),
      readAt: (value) => value.prefixReadAt,
      cache: {
        project: (value) => value,
        restore: (value) => {
          const snapshot = value as FeedResult
          return snapshot.generation === store.generation.value && snapshot.ids.every((id) => !!store.entries.value[id])
            ? snapshot
            : undefined
        },
      },
    },
  )
  function accept(value: FeedResult | undefined) {
    if (
      !value ||
      value.scope !== scopeKey.value ||
      value.page !== options.page.value ||
      value.generation !== store.generation.value ||
      scope.signal.aborted
    )
      return
    ids.value = [...new Set(value.ids)]
    total.value = value.total
    acceptedPage = value.page
    acceptedScope = value.scope
    prefixReadAt = value.prefixReadAt
    chunks.clear()
    value.chunks.forEach((chunk) => chunks.set(chunk.page, chunk.ids))
  }
  watch(result.data, accept, { immediate: true })
  watch(
    result.generation,
    () => {
      chunks.clear()
      ids.value = []
      total.value = 0
      acceptedPage = 0
      prefixReadAt = 0
    },
    { flush: 'sync' },
  )
  watch(
    [scopeKey, options.page],
    ([_current, page], [previous, previousPage]) => {
      if (timer) clearTimeout(timer)
      requestedScope.value = scopeKey.value
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
          void result.reload()
        }, 250)
      else {
        scheduled.value = false
        void result.reload()
      }
    },
    { flush: 'sync' },
  )
  onMounted(() => {
    // SSR 没有访客头；仅补取尚未由当前浏览器确认的个人状态，回访不重复请求。
    if (result.data.value?.ids.some((id) => !store.personalized.value[id])) void result.refresh()
  })
  await result
  if (
    result.data.value &&
    (result.data.value.scope !== scopeKey.value ||
      result.data.value.page !== options.page.value ||
      result.data.value.generation !== store.generation.value)
  )
    await result.reload()
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
      return result.refresh()
    },
  }
}
