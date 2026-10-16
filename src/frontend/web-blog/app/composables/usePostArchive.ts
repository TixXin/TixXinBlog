/** @file usePostArchive.ts @description 归档按年和页码读取，保留同查询成功结果并隔离迟到响应 */
import { fetchPostArchive } from '~/features/post/api'
import { mockPosts } from '~/features/post/mock'
import { postArchiveQuery, postArchiveYears } from '~/features/post/archive'
import type { PostArchivePage, PostArchiveQuery } from '~/features/post/types'

export async function usePostArchive() {
  const route = useRoute(),
    router = useRouter(),
    config = useRuntimeConfig(),
    app = useNuxtApp()
  const scope = usePageRequestScope()
  const ready = ref(false),
    hydrating = ref(import.meta.client && app.isHydrating)
  let initialQuery: PostArchiveQuery = postArchiveQuery(route.query)
  const serverKey = (app.payload.data['post-archive'] as { key?: string } | undefined)?.key
  if (hydrating.value && serverKey) {
    try {
      const serverQuery = JSON.parse(serverKey) as PostArchiveQuery
      initialQuery = postArchiveQuery({ ...serverQuery, year: serverQuery.year?.toString() })
    } catch {
      /* 无有效 SSR 查询时使用当前 URL。 */
    }
  }
  const query = computed(() => (hydrating.value ? initialQuery : postArchiveQuery(route.query)))
  const key = computed(() => JSON.stringify(query.value))
  const accepted = shallowRef<{ key: string; page: PostArchivePage } | null>(null)
  const result = usePublicReadData(
    'post-archive',
    async (_app, { signal }) => {
      const requested = key.value,
        current = query.value
      let page: PostArchivePage
      if (config.public.postUseMockRepo === false) {
        page = await fetchPostArchive(config.public.apiBaseUrl, current, AbortSignal.any([scope.signal, signal]))
      } else {
        const all = [...mockPosts].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
        const counts = new Map<number, number>()
        for (const post of all) {
          const year = Number(post.date.slice(0, 4))
          counts.set(year, (counts.get(year) ?? 0) + 1)
        }
        const filtered = all.filter((post) => !current.year || Number(post.date.slice(0, 4)) === current.year)
        page = {
          ...current,
          total: filtered.length,
          items: filtered
            .slice((current.page - 1) * current.pageSize, current.page * current.pageSize)
            .map(({ id, slug, title, folder, date }) => ({ id, slug, title, folder, date })),
          years: [...counts].sort(([a], [b]) => b - a).map(([year, count]) => ({ year, count })),
        }
      }
      return { key: requested, page }
    },
    { domain: 'archive', query: () => query.value },
  )
  watch(
    result.generation,
    () => {
      accepted.value = null
    },
    { flush: 'sync' },
  )
  watch(
    result.data,
    (value) => {
      if (value?.key === key.value && !scope.signal.aborted) accepted.value = value
    },
    { immediate: true },
  )
  watch(key, () => {
    void result.reload()
  })
  onMounted(() => {
    ready.value = true
    hydrating.value = false
  })
  const current = computed(() => (accepted.value?.key === key.value ? accepted.value.page : null))
  const pageCount = computed(() => Math.max(1, Math.ceil((current.value?.total ?? 0) / query.value.pageSize)))
  async function changeQuery(patch: { year?: number; page?: number }) {
    const next = { ...route.query, ...patch }
    return router.push({ path: '/archive', query: { ...next, page: next.page === 1 ? undefined : next.page } })
  }
  watch([ready, result.pending, result.error, current], () => {
    if (!ready.value || result.pending.value || result.error.value || !current.value) return
    if (query.value.page > pageCount.value)
      void router.replace({ query: { ...route.query, page: pageCount.value === 1 ? undefined : pageCount.value } })
  })
  await result
  scope.assertActive()
  if (result.data.value && result.data.value.key !== key.value) await result.reload()
  scope.assertActive()
  if (result.data.value?.key === key.value) accepted.value = result.data.value
  return {
    query,
    ready,
    current,
    pageCount,
    changeQuery,
    years: computed(() => accepted.value?.page.years ?? []),
    archiveYears: computed(() => postArchiveYears(current.value)),
    pending: result.pending,
    error: result.error,
    refresh: result.refresh,
  }
}
