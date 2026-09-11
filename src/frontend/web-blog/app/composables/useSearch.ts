/**
 * @file useSearch.ts
 * @description 六域公开检索；全部类型分组预览，单类型真实分页，取消与版本保护隔离迟到响应。
 */
import { fetchPostPage } from '~/features/post/api'
import { fetchFlashSearchPage } from '~/features/search/flash'
import { SEARCH_PAGE_SIZE, SEARCH_PREVIEW_SIZE, searchTypes, searchTypeLabels } from '~/features/search/types'
import type { SearchGroup, SearchResultItem, SearchScope, SearchSelection, SearchType } from '~/features/search/types'
import { searchPage, searchScope } from '~/features/search/query'
export type { SearchResultItem } from '~/features/search/types'

export function useSearch(options: { remember?: boolean } = {}) {
  const config = useRuntimeConfig()
  const projects = useProjectRepository(),
    links = useLinkRepository(),
    gallery = useGalleryRepository()
  const moments = useMomentRepository(),
    flashes = useFlashRepository()
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
  const text = (value: string) => value.replace(/\s+/g, ' ').trim()
  const item = (
    source: SearchType,
    id: string | number,
    title: string,
    description: string,
    url: string,
    icon: string,
  ): SearchResultItem => ({
    type: source,
    id: String(id),
    title: text(title).slice(0, 100),
    description: text(description).slice(0, 200),
    url,
    icon,
  })

  async function read(source: SearchType, keyword: string, currentPage: number, pageSize: number, signal: AbortSignal) {
    const paging = { q: keyword, page: currentPage, pageSize }
    if (source === 'post') {
      if (config.public.postUseMockRepo !== false) {
        const [{ mockPosts }, { default: Fuse }] = await Promise.all([
          import('~/features/post/mock'),
          import('fuse.js'),
        ])
        const matches = new Fuse(mockPosts, { keys: ['title', 'summary'], threshold: 0.4 }).search(keyword)
        return {
          total: matches.length,
          items: matches
            .slice((currentPage - 1) * pageSize, currentPage * pageSize)
            .map(({ item: post }) =>
              item(source, post.id, post.title, post.summary, articlePath(post), 'lucide:file-text'),
            ),
        }
      }
      const value = await fetchPostPage(
        config.public.apiBaseUrl,
        { search: keyword, page: currentPage, pageSize },
        signal,
      )
      return {
        total: value.total,
        items: value.items.map((post) =>
          item(source, post.id, post.title, post.summary, articlePath(post), 'lucide:file-text'),
        ),
      }
    }
    if (source === 'project') {
      const value = await projects.list(paging, signal)
      return {
        total: value.total,
        items: value.items.map((project) =>
          item(
            source,
            project.id,
            project.title,
            project.description,
            '/projects?project=' + project.id,
            'lucide:layers',
          ),
        ),
      }
    }
    if (source === 'link') {
      const value = await links.list(paging, signal)
      return {
        total: value.total,
        items: value.items.map((link) => item(source, link.id, link.name, link.description, link.url, 'lucide:link')),
      }
    }
    if (source === 'gallery') {
      const value = await gallery.list(paging, signal)
      return {
        total: value.total,
        items: value.items.map((photo) =>
          item(
            source,
            photo.id,
            photo.title,
            photo.description || photo.category,
            '/gallery?photo=' + photo.id,
            'lucide:images',
          ),
        ),
      }
    }
    if (source === 'moment') {
      const value = await moments.list(paging, signal)
      return {
        total: value.total,
        items: value.items.map((moment) =>
          item(
            source,
            moment.id,
            moment.content,
            moment.content,
            '/moments/' + encodeURIComponent(moment.id),
            'lucide:messages-square',
          ),
        ),
      }
    }
    if (config.public.useMockRepo !== false) {
      const notes = await (flashes.listPublic?.() ?? flashes.list('tixxin'))
      const matches = notes
        .filter(
          (note) =>
            !note.isDraft &&
            !note.isArchived &&
            (note.content.toLocaleLowerCase().includes(keyword.toLocaleLowerCase()) ||
              note.tags.some((tag) => tag.toLocaleLowerCase().includes(keyword.toLocaleLowerCase()))),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
      return {
        total: matches.length,
        items: matches
          .slice((currentPage - 1) * pageSize, currentPage * pageSize)
          .map((note) =>
            item(
              source,
              note.id,
              note.content,
              note.content,
              '/flash/' + encodeURIComponent(note.id),
              'lucide:lightbulb',
            ),
          ),
      }
    }
    const value = await fetchFlashSearchPage(config.public.apiBaseUrl, keyword, currentPage, pageSize, signal)
    return {
      total: value.total,
      items: value.items.map((note) =>
        item(source, note.id, note.content, note.content, '/flash/' + encodeURIComponent(note.id), 'lucide:lightbulb'),
      ),
    }
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
        sources.map((source) => read(source, keyword, currentPage, pageSize, controller!.signal)),
      )
      if (!owns()) return
      groups.value = responses.map((response, index) => ({
        type: sources[index]!,
        items: response.status === 'fulfilled' ? response.value.items : [],
        total: response.status === 'fulfilled' ? response.value.total : null,
        unavailable: response.status === 'rejected',
      }))
      const unavailable = groups.value.filter((group) => group.unavailable).map((group) => searchTypeLabels[group.type])
      error.value = unavailable.length
        ? `${unavailable.join('、')}搜索暂时不可用，请重试。${results.value.length ? '其他来源结果仍可使用。' : ''}`
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
