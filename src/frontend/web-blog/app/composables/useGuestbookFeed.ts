/** @file useGuestbookFeed.ts @description 留言游标流复用公开页索引缓存，实体及个人分页索引仍由原缓存持有 */
import type { GuestbookFeedSnapshot, GuestbookRecord, GuestbookQuery } from '~/features/guestbook/types'
export async function useGuestbookFeed(options: {
  q: Ref<string>
  date: Ref<string | null>
  beforeChange?: () => void
  afterChange?: () => void | Promise<void>
}) {
  const repo = useGuestbookRepository(),
    t = currentTranslate(),
    cache = useGuestbookCache(),
    scope = usePageRequestScope()
  const ids = ref<number[]>([]),
    total = ref(0),
    cursor = ref<string | null>(null)
  const pages = ref(1),
    morePending = ref(false),
    moreError = ref(''),
    scheduled = ref(false)
  const accepted = shallowRef<GuestbookFeedSnapshot | null>(null)
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
  async function readSnapshot(signal: AbortSignal, requestedPages: number): Promise<GuestbookFeedSnapshot> {
    const current = key.value,
      started = cache.clock.value,
      generation = cache.generation.value,
      currentQuery = query(),
      readAt = Date.now(),
      ownedSignal = AbortSignal.any([signal, scope.signal])
    requestedKey.value = current
    let before: string | undefined,
      count = 0,
      nextCursor: string | null = null,
      loadedPages = 0
    const items: GuestbookRecord[] = []
    for (let page = 0; page < requestedPages; page++) {
      if (ownedSignal.aborted) throw new DOMException('留言读取已取消', 'AbortError')
      const value = await repo.list({ ...currentQuery, before }, ownedSignal)
      items.push(...value.items)
      count = value.total
      nextCursor = value.nextCursor
      loadedPages++
      if (!nextCursor) break
      before = nextCursor
    }
    if (ownedSignal.aborted || generation !== cache.generation.value)
      throw new DOMException('留言读取已失效', 'AbortError')
    cache.accept(items, started, generation)
    return {
      ids: [...new Set(items.map((item) => item.id))],
      total: count,
      nextCursor,
      key: current,
      generation,
      readAt,
      pages: loadedPages,
      personalized: import.meta.client,
    }
  }
  const result = usePublicReadData('guestbook-feed', (_app, { signal }) => readSnapshot(signal, pages.value), {
    domain: 'guestbook-feed',
    query: () => query(),
    readAt: (value) => value.readAt,
    cache: {
      project: cache.project,
      restore: cache.restore,
      // 个人视图索引留在既有缓存的弱关联中，字节数仍扣减同一4MiB容量。
      additionalBytes: (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength,
    },
  })
  async function accept(value: GuestbookFeedSnapshot | undefined) {
    if (!value || value.key !== key.value || value.generation !== cache.generation.value || scope.signal.aborted) return
    const change = ++changeVersion
    if (import.meta.client) options.beforeChange?.()
    accepted.value = value
    ids.value = [...value.ids]
    total.value = value.total
    cursor.value = value.nextCursor
    pages.value = value.pages
    moreError.value = ''
    await nextTick()
    if (import.meta.client && change === changeVersion && !scope.signal.aborted) await options.afterChange?.()
  }
  let lastAcceptance: Promise<void> = Promise.resolve()
  watch(
    result.data,
    (value) => {
      lastAcceptance = accept(value)
    },
    { immediate: true },
  )
  function cancelMore() {
    moreVersion++
    moreController?.abort()
    morePending.value = false
  }
  let lastRefresh: Promise<void> | null = null
  function refresh(reset = false) {
    cancelMore()
    if (timer) clearTimeout(timer)
    scheduled.value = false
    if (reset) pages.value = 1
    lastRefresh = result.refresh()
    return lastRefresh
  }
  watch(
    result.generation,
    () => {
      cancelMore()
      accepted.value = null
      ids.value = []
      total.value = 0
      cursor.value = null
    },
    { flush: 'sync' },
  )
  // 在统一失效完成后启动，避免在clear之前发起又被取消；提交方可等待这次确认读取。
  watch(
    result.generation,
    () => {
      void refresh()
    },
    { flush: 'post' },
  )
  watch(key, () => {
    cancelMore()
    pages.value = 1
    if (timer) clearTimeout(timer)
    scheduled.value = true
    timer = setTimeout(() => {
      scheduled.value = false
      lastRefresh = result.reload()
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
      generation = cache.generation.value,
      readGeneration = result.generation.value
    moreController = new AbortController()
    const signal = AbortSignal.any([scope.signal, moreController.signal])
    morePending.value = true
    moreError.value = ''
    try {
      let snapshot: GuestbookFeedSnapshot
      if (!accepted.value || Date.now() - accepted.value.readAt >= 30_000) {
        // 旧前缀过期后完整核对；新的游标页不能给旧记录重新续期。
        snapshot = await readSnapshot(signal, pages.value + 1)
      } else {
        const value = await repo.list({ ...query(), before }, signal)
        if (
          signal.aborted ||
          version !== moreVersion ||
          key.value !== currentKey ||
          cursor.value !== before ||
          generation !== cache.generation.value
        )
          return
        cache.accept(value.items, started, generation)
        snapshot = {
          ids: [...new Set([...ids.value, ...value.items.map((item) => item.id)])],
          total: value.total,
          nextCursor: value.nextCursor,
          key: currentKey,
          generation,
          readAt: accepted.value.readAt,
          pages: pages.value + 1,
          personalized: import.meta.client,
        }
      }
      if (
        signal.aborted ||
        version !== moreVersion ||
        key.value !== currentKey ||
        generation !== cache.generation.value
      )
        return
      if (!result.publish(snapshot, readGeneration)) return
      await nextTick()
      await lastAcceptance
    } catch (cause) {
      if (version === moreVersion && !scope.signal.aborted)
        moreError.value = cause instanceof Error ? cause.message : t('interaction.guestbookSession.historyFailed')
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
    personalized: computed(() => !!accepted.value?.personalized),
    pending: computed(() => scheduled.value || result.pending.value),
    error: computed(() => (requestedKey.value === key.value ? result.error.value : undefined)),
    refresh,
    settled: async () => {
      await nextTick()
      await lastRefresh
    },
    loadMore,
    retryMore: () => {
      moreError.value = ''
      return loadMore()
    },
  }
}
