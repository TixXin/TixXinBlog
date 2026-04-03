/**
 * @file usePostListPagination.ts
 * @description 文章列表分页与瀑布流懒加载逻辑，含 IntersectionObserver 管理
 * @author TixXin
 * @since 2026-04-03
 */

import type { PostItem } from '~/features/post/types'

const PAGE_SIZE = 15
const SPINNER_DELAY = 250

interface PostListPaginationOptions {
  posts: Ref<PostItem[]>
  activeTab: Ref<string>
  displayMode: Ref<'waterfall' | 'pagination'>
  scrollbarRef: Ref<{ viewport: HTMLElement | null; scrollToTop: (smooth?: boolean) => void } | null>
}

export function usePostListPagination(options: PostListPaginationOptions) {
  const { posts, activeTab, displayMode, scrollbarRef } = options

  const filteredPosts = computed(() => {
    if (activeTab.value === 'all') return posts.value
    return posts.value.filter(p => p.category === activeTab.value)
  })

  // 瀑布流模式状态
  const displayCount = ref(PAGE_SIZE)
  const loading = ref(false)
  const showSpinner = ref(false)
  const sentinelRef = ref<HTMLElement | null>(null)
  let spinnerTimer: ReturnType<typeof setTimeout> | null = null

  // 分页模式状态
  const currentPage = ref(1)
  const paginationKey = computed(() => `${activeTab.value}-${currentPage.value}`)

  const totalPages = computed(() =>
    Math.ceil(filteredPosts.value.length / PAGE_SIZE),
  )

  const displayedPosts = computed(() => {
    if (displayMode.value === 'pagination') {
      const start = (currentPage.value - 1) * PAGE_SIZE
      return filteredPosts.value.slice(start, start + PAGE_SIZE)
    }
    return filteredPosts.value.slice(0, displayCount.value)
  })

  const hasMore = computed(() =>
    displayCount.value < filteredPosts.value.length,
  )

  const pageList = computed(() => {
    const total = totalPages.value
    const current = currentPage.value
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1)
    }
    const pages: (number | string)[] = [1]
    if (current > 3) pages.push('...')
    const start = Math.max(2, current - 1)
    const end = Math.min(total - 1, current + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    if (current < total - 2) pages.push('...')
    pages.push(total)
    return pages
  })

  function goToPage(page: number) {
    if (page < 1 || page > totalPages.value || page === currentPage.value) return
    currentPage.value = page
    scrollbarRef.value?.scrollToTop(true)
  }

  // Tab / 显示模式切换时重置
  watch(activeTab, () => {
    displayCount.value = PAGE_SIZE
    currentPage.value = 1
    scrollbarRef.value?.scrollToTop(false)
  })

  watch(displayMode, () => {
    displayCount.value = PAGE_SIZE
    currentPage.value = 1
    scrollbarRef.value?.scrollToTop(false)
  })

  // 瀑布流加载逻辑
  function clearSpinnerTimer() {
    if (spinnerTimer) {
      clearTimeout(spinnerTimer)
      spinnerTimer = null
    }
  }

  function loadMore() {
    if (loading.value || !hasMore.value) return
    loading.value = true

    clearSpinnerTimer()
    spinnerTimer = setTimeout(() => {
      if (loading.value) showSpinner.value = true
    }, SPINNER_DELAY)

    requestAnimationFrame(() => {
      displayCount.value = Math.min(
        displayCount.value + PAGE_SIZE,
        filteredPosts.value.length,
      )
      loading.value = false
      showSpinner.value = false
      clearSpinnerTimer()
    })
  }

  // IntersectionObserver 管理
  const BREAKPOINT_XL = 1280
  let observer: IntersectionObserver | null = null
  let resizeCleanup: (() => void) | null = null

  function getScrollRoot(): Element | null {
    if (import.meta.server) return null
    const vp = scrollbarRef.value?.viewport
    const el = unref(vp)
    return el instanceof HTMLElement ? el : null
  }

  function getObserverRoot(): Element | null {
    if (import.meta.server) return null
    if (window.innerWidth < BREAKPOINT_XL) return null
    const root = getScrollRoot()
    if (!root) return null
    if (root.scrollHeight <= root.clientHeight + 1) return null
    return root
  }

  function setupObserver() {
    observer?.disconnect()
    if (displayMode.value !== 'waterfall') return

    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore()
        }
      },
      {
        root: getObserverRoot(),
        rootMargin: '0px 0px 600px 0px',
      },
    )

    if (sentinelRef.value) {
      observer.observe(sentinelRef.value)
    }
  }

  watch(sentinelRef, (el) => {
    if (el && observer) {
      observer.observe(el)
    }
  })

  watch(
    () => [getScrollRoot(), sentinelRef.value] as const,
    ([root, sentinel]) => {
      if (root && sentinel) {
        setupObserver()
      }
    },
    { immediate: true },
  )

  watch(displayMode, () => {
    if (displayMode.value === 'waterfall') {
      nextTick(() => setupObserver())
    } else {
      observer?.disconnect()
      observer = null
    }
  })

  onMounted(() => {
    nextTick(() => setupObserver())

    let prevIsXl = window.innerWidth >= BREAKPOINT_XL
    const onResize = () => {
      const nowIsXl = window.innerWidth >= BREAKPOINT_XL
      if (nowIsXl !== prevIsXl) {
        prevIsXl = nowIsXl
        setupObserver()
      }
    }
    window.addEventListener('resize', onResize)
    resizeCleanup = () => window.removeEventListener('resize', onResize)
  })

  onUnmounted(() => {
    observer?.disconnect()
    observer = null
    resizeCleanup?.()
    resizeCleanup = null
    clearSpinnerTimer()
  })

  return {
    filteredPosts,
    displayedPosts,
    displayCount,
    hasMore,
    showSpinner,
    sentinelRef,
    currentPage,
    totalPages,
    paginationKey,
    pageList,
    goToPage,
  }
}
