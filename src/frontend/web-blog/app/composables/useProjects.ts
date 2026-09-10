/** @file useProjects.ts @description 项目 SSR 列表与统计，统一 URL 查询并保留上次成功读取的数据 */
import type { ProjectPage, ProjectQuery } from '~/features/project/types'
import { projectQuery } from '~/features/project/query'
export async function useProjects() {
  const repo = useProjectRepository(),
    route = useRoute(),
    router = useRouter(),
    scope = usePageRequestScope()
  const app = useNuxtApp()
  const ready = ref(false),
    hydrating = ref(import.meta.client && app.isHydrating)
  let initialQuery: ProjectQuery = projectQuery(route.query)
  const serverKey = (app.payload.data['projects-feed'] as { key?: string } | undefined)?.key
  if (hydrating.value && serverKey) {
    try {
      initialQuery = projectQuery(JSON.parse(serverKey))
    } catch {
      /* 无有效 SSR 查询时沿用初始路由。 */
    }
  }
  // 历史导航可能早于异步页面水合完成；首帧必须与 SSR payload/DOM 使用同一个查询。
  const query = computed(() => (hydrating.value ? initialQuery : projectQuery(route.query))),
    key = computed(() => JSON.stringify(query.value))
  const accepted = ref<{ key: string; page: ProjectPage } | null>(null)
  onMounted(() => {
    ready.value = true
    hydrating.value = false
  })
  const feed = useAsyncData('projects-feed', async (_app, { signal }) => {
    const current = key.value
    return { key: current, page: await repo.list(query.value, AbortSignal.any([scope.signal, signal])) }
  })
  // Nuxt 内置 watch 会等待尚未完成的防抖调用；查询切换必须立即取消旧读取。
  watch(key, () => {
    void feed.refresh({ dedupe: 'cancel', cachedData: undefined })
  })
  const metadata = useAsyncData('projects-metadata', (_app, { signal }) =>
    repo.metadata(AbortSignal.any([scope.signal, signal])),
  )
  watch(
    feed.data,
    (value) => {
      if (value?.key === key.value && !scope.signal.aborted) accepted.value = value
    },
    { immediate: true },
  )
  function changeQuery(patch: Record<string, string | number | undefined>) {
    return router.push({ path: '/projects', query: { ...route.query, page: undefined, ...patch } })
  }
  await Promise.all([feed, metadata])
  scope.assertActive()
  if (feed.data.value && feed.data.value.key !== key.value) await feed.refresh()
  scope.assertActive()
  if (feed.data.value?.key === key.value) accepted.value = feed.data.value
  return {
    query,
    ready,
    projects: computed(() => accepted.value?.page.items ?? []),
    total: computed(() => accepted.value?.page.total ?? null),
    stale: computed(() => !!accepted.value && accepted.value.key !== key.value),
    pending: feed.pending,
    error: feed.error,
    refresh: feed.refresh,
    metadata: metadata.data,
    metadataPending: metadata.pending,
    metadataError: metadata.error,
    refreshMetadata: metadata.refresh,
    changeQuery,
  }
}
