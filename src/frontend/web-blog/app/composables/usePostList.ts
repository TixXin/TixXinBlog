/**
 * @file usePostList.ts
 * @description 文章分页数据源：筛选条件和页码交给服务端，瀑布流只累积已请求的页
 */
import { mockPosts } from '~/features/post/mock'
import { fetchPostPage } from '~/features/post/api'
import type { PostItem, PostPage } from '~/features/post/types'

export async function usePostList(options: {
  page: Ref<number>
  selectedTag: Ref<string | null>
  selectedCategory: Ref<string | null>
  displayMode: Ref<'waterfall' | 'pagination'>
  /** URL受控列表在用户操作时自行归一页码，浏览器历史恢复不能再次重置。 */
  resetOnScopeChange?: boolean
}) {
  const config = useRuntimeConfig()
  const pageSize = 15
  const accumulated = ref<PostItem[]>([])
  const total = ref(0)
  const filters = computed(() => ({
    tag: options.selectedTag.value || undefined,
    folder: options.selectedCategory.value || undefined,
  }))
  const scopeKey = computed(() => JSON.stringify({ ...filters.value, mode: options.displayMode.value }))
  const pages = new Map<number, PostItem[]>()
  watch(
    [filters, options.displayMode],
    () => {
      if (options.resetOnScopeChange !== false) options.page.value = 1
      pages.clear()
      accumulated.value = []
      total.value = 0
    },
    { flush: 'sync' },
  )
  type CollectionPage = PostPage & { scopeKey: string; chunks: { page: number; items: PostItem[] }[] }
  const result = useAsyncData('post-list', async (_app, { signal }): Promise<CollectionPage> => {
    const query = { ...filters.value, page: options.page.value, pageSize }
    const requestedScope = scopeKey.value
    const continuous = options.displayMode.value === 'waterfall'
    const chunks = continuous
      ? new Map([...pages.entries()].filter(([page]) => page <= query.page))
      : new Map<number, PostItem[]>()
    let knownTotal: number | null = chunks.size ? total.value : null
    // 冷启动连续模式的历史URL按页补齐前缀；常规触底仅请求尚未加载的新页。
    for (let page = continuous ? 1 : query.page; page <= query.page; page++) {
      if (signal.aborted) throw new DOMException('请求已被替换', 'AbortError')
      if (continuous && knownTotal !== null && page > Math.max(1, Math.ceil(knownTotal / pageSize))) break
      if (chunks.has(page) && page !== query.page) continue
      let value: PostPage
      if (config.public.postUseMockRepo !== false) {
        const filtered = mockPosts.filter(
          (post) =>
            (!query.tag || post.tags.some((tag) => tag.label === query.tag)) &&
            (!query.folder || post.folder === query.folder),
        )
        value = {
          items: filtered.slice((page - 1) * pageSize, page * pageSize),
          total: filtered.length,
          page,
          pageSize,
        }
      } else {
        value = await fetchPostPage(config.public.apiBaseUrl, { ...query, page })
      }
      knownTotal = value.total
      chunks.set(page, value.items)
    }
    return {
      items: chunks.get(query.page) ?? [],
      total: knownTotal ?? 0,
      page: query.page,
      pageSize,
      scopeKey: requestedScope,
      chunks: [...chunks.entries()].sort(([a], [b]) => a - b).map(([page, items]) => ({ page, items })),
    }
  })
  // 当前 Nuxt 的自动参数监听会等待旧请求结束；筛选变化需要立即取消旧任务并取新条件。
  watch([filters, options.page, options.displayMode], () => result.refresh({ dedupe: 'cancel' }))
  function acceptPage(value: CollectionPage | undefined) {
    // 旧条件的响应不能重新填入当前列表；初始缓存也必须进入累计集合。
    if (!value || value.scopeKey !== scopeKey.value || value.page !== options.page.value) return
    total.value = value.total
    pages.clear()
    for (const chunk of value.chunks) pages.set(chunk.page, chunk.items)
    const ordered = [...pages.entries()].sort(([a], [b]) => a - b).flatMap(([, items]) => items)
    accumulated.value = [...new Map(ordered.map((post) => [post.id, post])).values()]
  }
  watch(result.data, acceptPage, { immediate: true })
  await result
  if (
    result.data.value &&
    (result.data.value.scopeKey !== scopeKey.value || result.data.value.page !== options.page.value)
  )
    await result.refresh({ dedupe: 'cancel' })
  // SSR 不持续运行响应式监听；首次请求完成后也要直接种入返回页面。
  acceptPage(result.data.value)
  return {
    posts: computed(() => accumulated.value),
    total: computed(() => total.value),
    pending: result.pending,
    error: result.error,
    refresh: result.refresh,
    pageSize,
  }
}
