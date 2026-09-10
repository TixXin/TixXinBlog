/**
 * @file usePostListPagination.ts
 * @description 受控分页和触底事件：组件只发出页码请求，真实取数由页面数据源负责
 */
import type { PostItem } from '~/features/post/types'
import { isNavigationFailure, NavigationFailureType } from 'vue-router'

export function usePostListPagination(options: {
  posts: Ref<PostItem[]>
  total: Ref<number>
  currentPage: Ref<number>
  pending: Ref<boolean>
  error: Ref<string>
  displayMode: Ref<'waterfall' | 'pagination'>
  scrollbarRef: Ref<{ viewport: HTMLElement | null; scrollToTop: (smooth?: boolean) => void } | null>
  requestPage: (page: number) => void
}) {
  const pageSize = 15
  const sentinelRef = ref<HTMLElement | null>(null)
  const currentPage = options.currentPage
  let leavingTo: string | undefined
  const router = useRouter()
  onBeforeRouteLeave((to) => {
    leavingTo = to.fullPath
    observer?.disconnect()
  })
  const removeAfter = router.afterEach((to, from, failure) => {
    if (
      router.currentRoute.value.path === '/' &&
      ((!failure && to.path === '/') ||
        (to.fullPath === leavingTo && from.path === '/' && isNavigationFailure(failure, NavigationFailureType.aborted)))
    ) {
      leavingTo = undefined
      pageRequested.value = false
      observe()
    }
  })
  // 在父页面的 pending 更新前锁住本次触底请求，避免观察器连续推进页码。
  const pageRequested = ref(false)
  watch(
    options.pending,
    (pending) => {
      if (!pending) pageRequested.value = false
    },
    { flush: 'sync' },
  )
  watch(options.displayMode, () => {
    pageRequested.value = false
  })
  const totalPages = computed(() => Math.max(1, Math.ceil(options.total.value / pageSize)))
  const hasMore = computed(() => currentPage.value * pageSize < options.total.value)
  const pageList = computed(() => {
    const total = totalPages.value
    const current = currentPage.value
    if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
    const pages: Array<number | string> = [1]
    if (current > 3) pages.push('...')
    for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page += 1) pages.push(page)
    if (current < total - 2) pages.push('...')
    pages.push(total)
    return pages
  })
  function goToPage(page: number) {
    if (
      leavingTo ||
      router.currentRoute.value.path !== '/' ||
      page < 1 ||
      page > totalPages.value ||
      page === currentPage.value
    )
      return
    // 触底追加需要串行；显式翻页允许新请求替换正在等待的旧页。
    if (options.displayMode.value === 'waterfall') {
      if (pageRequested.value || options.pending.value) return
      pageRequested.value = true
    }
    options.requestPage(page)
    // URL驱动的滚动恢复统一负责落点，避免平滑回顶与历史恢复同时争用滚动根。
  }
  let observer: IntersectionObserver | null = null
  function observe() {
    observer?.disconnect()
    if (
      leavingTo ||
      router.currentRoute.value.path !== '/' ||
      options.displayMode.value !== 'waterfall' ||
      !sentinelRef.value ||
      options.error.value
    )
      return
    const viewport = options.scrollbarRef.value?.viewport
    const root = viewport && viewport.scrollHeight > viewport.clientHeight + 1 ? viewport : null
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && hasMore.value) goToPage(currentPage.value + 1)
      },
      { root, rootMargin: '0px 0px 400px 0px' },
    )
    observer.observe(sentinelRef.value)
  }
  onMounted(() => {
    watch([sentinelRef, options.posts, options.displayMode, options.pending], () => nextTick(observe), {
      immediate: true,
    })
  })
  onUnmounted(() => {
    observer?.disconnect()
    removeAfter()
  })
  return {
    filteredPosts: options.posts,
    displayedPosts: options.posts,
    displayCount: computed(() => options.posts.value.length),
    hasMore,
    showSpinner: options.pending,
    sentinelRef,
    currentPage,
    totalPages,
    pageList,
    goToPage,
  }
}
