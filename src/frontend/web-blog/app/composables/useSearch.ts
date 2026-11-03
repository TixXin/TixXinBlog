/**
 * @file useSearch.ts
 * @description 六域公开检索；全部类型分组预览，单类型真实分页，取消与版本保护隔离迟到响应。
 * 各来源的读取与结果映射见 features/search/sources.ts。
 */
import { readSearchSource, type SearchSourceContext } from '~/features/search/sources'
import { SEARCH_PAGE_SIZE, SEARCH_PREVIEW_SIZE, searchTypes, searchTypeLabel } from '~/features/search/types'
import type { SearchGroup, SearchScope, SearchSelection } from '~/features/search/types'
import { searchPage, searchScope } from '~/features/search/query'
export type { SearchResultItem } from '~/features/search/types'

export function useSearch(options: { remember?: boolean } = {}) {
  const config = useRuntimeConfig()
  // 用全局 i18n 实例而非 useI18n：本 composable 也会在插件或测试中脱离组件 setup 调用
  const { t } = useNuxtApp().$i18n
  const selection = options.remember
    ? useState<SearchSelection>('search-dialog-selection', () => ({ query: '', type: 'all', page: 1 }))
    : ref<SearchSelection>({ query: '', type: 'all', page: 1 })
  const query = computed({
    get: () => selection.value.query,
    set: (value) => {
      selection.value.query = value
    },
  })
  const type = computed({
    get: () => selection.value.type,
    set: (value: SearchScope) => {
      selection.value.type = value
    },
  })
  const page = computed({
    get: () => selection.value.page,
    set: (value: number) => {
      selection.value.page = value
    },
  })
  const groups = ref<SearchGroup[]>([])
  const results = computed(() => groups.value.flatMap((group) => group.items))
  const total = computed(() =>
    groups.value.length && groups.value.every((group) => group.total !== null)
      ? groups.value.reduce((sum, group) => sum + group.total!, 0)
      : null,
  )
  const isSearching = ref(false),
    error = ref('')
  let version = 0,
    controller: AbortController | undefined,
    alive = true
  const context: SearchSourceContext = {
    apiBaseUrl: config.public.apiBaseUrl,
    postMock: config.public.postUseMockRepo !== false,
    mock: config.public.useMockRepo !== false,
    projects: useProjectRepository(),
    links: useLinkRepository(),
    gallery: useGalleryRepository(),
    moments: useMomentRepository(),
    flashes: useFlashRepository(),
  }

  function cancel() {
    version++
    controller?.abort()
    isSearching.value = false
  }
  async function search(q: string, scope: SearchScope = type.value, requestedPage = page.value) {
    const requestVersion = ++version
    controller?.abort()
    query.value = q
    type.value = searchScope(scope)
    page.value = type.value === 'all' ? 1 : searchPage(requestedPage)
    error.value = ''
    if (!q.trim()) {
      groups.value = []
      isSearching.value = false
      return
    }
    isSearching.value = true
    controller = new AbortController()
    const keyword = q.trim().slice(0, 200),
      currentType = type.value,
      currentPage = page.value
    const sources = currentType === 'all' ? [...searchTypes] : [currentType]
    const pageSize = currentType === 'all' ? SEARCH_PREVIEW_SIZE : SEARCH_PAGE_SIZE
    const owns = () =>
      alive &&
      requestVersion === version &&
      query.value === q &&
      type.value === currentType &&
      page.value === currentPage
    try {
      const responses = await Promise.allSettled(
        sources.map((source) =>
          readSearchSource(context, { source, keyword, page: currentPage, pageSize, signal: controller!.signal }),
        ),
      )
      if (!owns()) return
      groups.value = responses.map((response, index) => ({
        type: sources[index]!,
        items: response.status === 'fulfilled' ? response.value.items : [],
        total: response.status === 'fulfilled' ? response.value.total : null,
        unavailable: response.status === 'rejected',
      }))
      const unavailable = groups.value
        .filter((group) => group.unavailable)
        .map((group) => searchTypeLabel(group.type, t))
      error.value = unavailable.length
        ? t('article.search.unavailable', { types: unavailable.join(t('article.search.listSeparator')) }) +
          (results.value.length ? t('article.search.othersAvailable') : '')
        : ''
    } finally {
      if (owns()) isSearching.value = false
    }
  }
  onScopeDispose(() => {
    alive = false
    cancel()
  })
  return { query, type, page, groups, results, total, isSearching, error, search, cancel }
}
