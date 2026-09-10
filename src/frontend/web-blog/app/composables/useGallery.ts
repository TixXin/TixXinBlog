/** @file useGallery.ts @description 图库统一 URL、服务端定位与灯箱读取，SSR 数据共享且迟到响应不覆盖当前选择 */
import type { GalleryNavigation, GalleryPage, GalleryQuery, PhotoItem } from '~/features/gallery/types'
import { galleryPhotoId, galleryQuery } from '~/features/gallery/query'
export async function useGallery() {
  const route = useRoute(),
    router = useRouter(),
    repo = useGalleryRepository(),
    scope = usePageRequestScope()
  const app = useNuxtApp(),
    hydrating = ref(import.meta.client && app.isHydrating)
  let initialQuery: GalleryQuery = galleryQuery(route.query),
    initialSelectedId = galleryPhotoId(route.query.photo)
  if (hydrating.value) {
    const serverKey = (app.payload.data['gallery-feed'] as { key?: string } | undefined)?.key
    if (serverKey) {
      try {
        initialQuery = galleryQuery(JSON.parse(serverKey))
      } catch {
        /* 无有效 SSR 查询时沿用初始路由。 */
      }
    }
    const selected = (app.payload.data['gallery-selection'] as { id?: number | null } | undefined)?.id
    if (selected === null || (typeof selected === 'number' && Number.isSafeInteger(selected) && selected > 0))
      initialSelectedId = selected
  }
  // 历史导航也可能更改 photo；首帧列表与灯箱必须同时对应 SSR DOM，挂载后再消费最新 URL。
  const query = computed(() => (hydrating.value ? initialQuery : galleryQuery(route.query))),
    key = computed(() => JSON.stringify(query.value))
  const selectedId = computed(() => (hydrating.value ? initialSelectedId : galleryPhotoId(route.query.photo)))
  const selectionKey = computed(() =>
    JSON.stringify({ q: query.value.q, category: query.value.category, pageSize: query.value.pageSize }),
  )
  const accepted = ref<{ key: string; page: GalleryPage } | null>(null)
  const mounted = ref(false),
    moving = ref(false)
  let openerId: number | null = null,
    moveVersion = 0
  let pendingFocus: { id: number; key: string; root: HTMLElement } | null = null
  const feed = useAsyncData('gallery-feed', async (_app, { signal }) => {
    const current = key.value
    return { key: current, page: await repo.list(query.value, AbortSignal.any([signal, scope.signal])) }
  })
  watch(key, () => {
    void feed.refresh({ dedupe: 'cancel', cachedData: undefined })
  })
  const overview = useAsyncData('gallery-metadata', (_app, { signal }) =>
    repo.metadata(AbortSignal.any([signal, scope.signal])),
  )
  const requestedSelection = ref({ id: selectedId.value, key: selectionKey.value })
  const selection = useAsyncData('gallery-selection', async (_app, { signal }) => {
    const id = selectedId.value,
      current = selectionKey.value
    requestedSelection.value = { id, key: current }
    if (!id) return { id: null, key: current, item: null, navigation: null }
    const ownedSignal = AbortSignal.any([signal, scope.signal])
    const [item, navigation] = await Promise.all([
      repo.detail(id, ownedSignal),
      repo.navigation(id, query.value, ownedSignal),
    ])
    return { id, key: current, item, navigation }
  })
  watch([selectedId, selectionKey], () => {
    void selection.refresh({ dedupe: 'cancel', cachedData: undefined })
  })
  watch(
    feed.data,
    (value) => {
      if (value?.key !== key.value || scope.signal.aborted) return
      accepted.value = value
      if (import.meta.client && pendingFocus)
        void nextTick(() => {
          const target = pendingFocus
          if (
            !target ||
            selectedId.value !== null ||
            key.value !== target.key ||
            document.activeElement !== target.root ||
            scope.signal.aborted
          )
            return
          document
            .querySelector<HTMLElement>(`[data-focus-key="gallery-photo-${target.id}"]`)
            ?.focus({ preventScroll: true })
          pendingFocus = null
        })
    },
    { immediate: true },
  )
  const photos = computed(() => accepted.value?.page.items ?? [])
  const currentSelection = computed(() =>
    selection.data.value?.id === selectedId.value && selection.data.value?.key === selectionKey.value
      ? selection.data.value
      : null,
  )
  const detailError = computed(() =>
    selectedId.value &&
    requestedSelection.value.id === selectedId.value &&
    requestedSelection.value.key === selectionKey.value
      ? (selection.error.value?.message ?? '')
      : '',
  )
  const selectedPhoto = computed<PhotoItem | null>(() =>
    detailError.value
      ? null
      : (currentSelection.value?.item ?? photos.value.find((item) => item.id === selectedId.value) ?? null),
  )
  const neighbors = computed<GalleryNavigation | null>(() => currentSelection.value?.navigation ?? null)
  function normalizeLocation() {
    const location = neighbors.value
    if (
      !mounted.value ||
      !location?.matched ||
      !location.page ||
      location.page === query.value.page ||
      scope.signal.aborted
    )
      return
    // 首次水合使用 SSR 同一份列表；事件接管后才规范深链页码，避免服务端与客户端首帧不同。
    void router.replace({ query: { ...route.query, page: location.page === 1 ? undefined : location.page } })
  }
  watch([selection.data, () => query.value.page], normalizeLocation)
  onMounted(() => {
    mounted.value = true
    hydrating.value = false
    normalizeLocation()
  })
  function changeQuery(patch: Record<string, string | number | undefined>) {
    return router.push({ path: '/gallery', query: { ...route.query, photo: undefined, page: undefined, ...patch } })
  }
  async function move(offset: -1 | 1) {
    if (moving.value || selection.pending.value || !neighbors.value?.matched) return
    const id = offset < 0 ? neighbors.value.previousId : neighbors.value.nextId
    const page = offset < 0 ? neighbors.value.previousPage : neighbors.value.nextPage
    if (!id || !page) return
    const version = ++moveVersion
    moving.value = true
    try {
      await router.push({ query: { ...route.query, page: page === 1 ? undefined : page, photo: id } })
    } finally {
      if (version === moveVersion) moving.value = false
    }
  }
  async function close() {
    const selected = selectedId.value
    await router.push({ query: { ...route.query, photo: undefined } })
    await nextTick()
    if (!import.meta.client || !selected) return
    if (accepted.value?.key !== key.value) {
      const root = document.querySelector<HTMLElement>('.gallery-body')
      if (root) {
        root.focus({ preventScroll: true })
        pendingFocus = { id: selected, key: key.value, root }
      }
    } else if (!openerId || !document.querySelector(`[data-focus-key="gallery-photo-${openerId}"]`)) {
      document
        .querySelector<HTMLElement>(`[data-focus-key="gallery-photo-${selected}"]`)
        ?.focus({ preventScroll: true })
    }
  }
  onScopeDispose(() => {
    moveVersion++
    pendingFocus = null
  })
  await Promise.all([feed, overview, selection])
  scope.assertActive()
  if (feed.data.value && feed.data.value.key !== key.value) await feed.refresh()
  scope.assertActive()
  if (feed.data.value?.key === key.value) accepted.value = feed.data.value
  if (
    selection.data.value &&
    (selection.data.value.id !== selectedId.value || selection.data.value.key !== selectionKey.value)
  )
    await selection.refresh()
  scope.assertActive()
  return {
    query,
    ready: mounted,
    photos,
    total: computed(() => accepted.value?.page.total ?? null),
    selectedId,
    selectedPhoto,
    pending: feed.pending,
    error: feed.error,
    refresh: feed.refresh,
    stale: computed(() => !!accepted.value && accepted.value.key !== key.value),
    metadata: overview.data,
    metadataPending: overview.pending,
    metadataError: overview.error,
    refreshMetadata: overview.refresh,
    detailPending: selection.pending,
    detailError,
    readSelection: selection.refresh,
    moving,
    move,
    changeQuery,
    canPrevious: computed(() => !!neighbors.value?.previousId),
    canNext: computed(() => !!neighbors.value?.nextId),
    open: (photo: PhotoItem) => {
      pendingFocus = null
      openerId = photo.id
      return router.push({ query: { ...route.query, photo: photo.id } })
    },
    close,
  }
}
