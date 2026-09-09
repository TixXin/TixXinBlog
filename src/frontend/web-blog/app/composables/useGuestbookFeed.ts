/** @file useGuestbookFeed.ts @description 留言游标流；保留最后成功内容，读写分离并取消旧查询，滚动交由页面钩子处理 */
import type { GuestbookRecord, GuestbookQuery } from '~/features/guestbook/types'
export async function useGuestbookFeed(options: {
  q: Ref<string>
  date: Ref<string | null>
  beforeChange?: () => void
  afterChange?: () => void | Promise<void>
}) {
  const repo = useGuestbookRepository(),
    cache = useGuestbookCache(),
    scope = usePageRequestScope()
  const ids = ref<number[]>([]),
    total = ref(0),
    cursor = ref<string | null>(null)
  const pages = ref(1),
    morePending = ref(false),
    moreError = ref(''),
    scheduled = ref(false)
  let moreVersion = 0,
    changeVersion = 0,
    moreController: AbortController | null = null,
    timer: ReturnType<typeof setTimeout> | undefined
  const key = computed(() => JSON.stringify({ q: options.q.value, date: options.date.value }))
  const requestedKey = ref(key.value)
  const query = (): GuestbookQuery => ({
    q: options.q.value || undefined,
    date: options.date.value || undefined,
    pageSize: 20,
  })
  const result = useAsyncData('guestbook-feed', async (_app, { signal }) => {
    const current = key.value,
      started = cache.clock.value,
      generation = cache.generation.value,
      currentQuery = query()
    requestedKey.value = current
    let before: string | undefined,
      count = 0,
      nextCursor: string | null = null
    const items: GuestbookRecord[] = []
    for (let page = 0; page < pages.value; page++) {
      const value = await repo.list({ ...currentQuery, before }, AbortSignal.any([signal, scope.signal]))
      items.push(...value.items)
      count = value.total
      nextCursor = value.nextCursor
      if (!nextCursor) break
      before = nextCursor
    }
    return { items, total: count, nextCursor, key: current, started, generation, personalized: import.meta.client }
  })
  async function accept(value: typeof result.data.value) {
    if (!value || value.key !== key.value || value.generation !== cache.generation.value || scope.signal.aborted) return
    const change = ++changeVersion
    if (import.meta.client) options.beforeChange?.()
    cache.accept(value.items, value.started, value.generation)
    ids.value = [...new Set(value.items.map((item) => item.id))]
    total.value = value.total
    cursor.value = value.nextCursor
    moreError.value = ''
    await nextTick()
    if (import.meta.client && change === changeVersion && !scope.signal.aborted) await options.afterChange?.()
  }
  watch(
    result.data,
    (value) => {
      void accept(value)
    },
    { immediate: true },
  )
  function cancelMore() {
    moreVersion++
    moreController?.abort()
    morePending.value = false
    moreError.value = ''
  }
  let lastRefresh: ReturnType<typeof result.refresh> | null = null
  function refresh(reset = false) {
    cancelMore()
    if (timer) clearTimeout(timer)
    scheduled.value = false
    if (reset) pages.value = 1
    lastRefresh = result.refresh({ dedupe: 'cancel', cachedData: undefined })
    return lastRefresh
  }
  watch(
    cache.generation,
    () => {
      void refresh()
    },
    { flush: 'sync' },
  )
  watch(key, () => {
    cancelMore()
    pages.value = 1
    if (timer) clearTimeout(timer)
    scheduled.value = true
    timer = setTimeout(() => {
      scheduled.value = false
      void refresh()
    }, 250)
  })
  onMounted(() => {
    if (result.data.value && !result.data.value.personalized) void refresh()
  })
  onScopeDispose(() => {
    cancelMore()
    if (timer) clearTimeout(timer)
  })
  async function loadMore() {
    if (
      !cursor.value ||
      morePending.value ||
      result.pending.value ||
      scheduled.value ||
      result.error.value ||
      moreError.value
    )
      return
    const before = cursor.value,
      currentKey = key.value,
      version = ++moreVersion,
      started = cache.clock.value,
      generation = cache.generation.value
    moreController = new AbortController()
    morePending.value = true
    moreError.value = ''
    try {
      const value = await repo.list({ ...query(), before }, AbortSignal.any([scope.signal, moreController.signal]))
      if (
        version !== moreVersion ||
        key.value !== currentKey ||
        cursor.value !== before ||
        generation !== cache.generation.value
      )
        return
      const change = ++changeVersion
      if (import.meta.client) options.beforeChange?.()
      cache.accept(value.items, started, generation)
      ids.value = [...new Set([...ids.value, ...value.items.map((item) => item.id)])]
      cursor.value = value.nextCursor
      total.value = value.total
      pages.value++
      await nextTick()
      if (import.meta.client && change === changeVersion && !scope.signal.aborted) await options.afterChange?.()
    } catch (cause) {
      if (version === moreVersion && !scope.signal.aborted)
        moreError.value = cause instanceof Error ? cause.message : '历史留言加载失败，请重试'
    } finally {
      if (version === moreVersion) morePending.value = false
    }
  }
  await result
  scope.assertActive()
  if (
    result.data.value &&
    (result.data.value.key !== key.value || result.data.value.generation !== cache.generation.value)
  )
    await refresh()
  await accept(result.data.value)
  return {
    items: computed(() =>
      ids.value.map((id) => cache.entries.value[id]).filter((item): item is GuestbookRecord => !!item),
    ),
    total,
    hasMore: computed(() => !!cursor.value),
    morePending,
    moreError,
    personalized: computed(() => !!result.data.value?.personalized),
    pending: computed(() => scheduled.value || result.pending.value),
    error: computed(() => (requestedKey.value === key.value ? result.error.value : undefined)),
    refresh,
    settled: () => lastRefresh ?? Promise.resolve(),
    loadMore,
    retryMore: () => {
      moreError.value = ''
      return loadMore()
    },
  }
}
