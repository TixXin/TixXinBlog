<!--
  @file PostCardList.vue
  @description 文章列表组件，按当前选中 Tab 过滤并渲染文章列表项，支持瀑布流懒加载与分页两种显示模式
  @author TixXin
  @since 2025-03-17
-->

<template>
    <CommonCustomScrollbar
      ref="scrollbarRef"
      class="main-content__body"
      viewport-class="post-list-viewport"
      :show-progress="displayMode === 'waterfall'"
      show-back-to-top
    >
    <div class="post-list">
      <BlogPostCard
        v-for="post in displayedPosts"
        :key="post.id"
        :post="post"
      />
    </div>

    <p v-if="filteredPosts.length === 0" class="post-list__empty">
      暂无相关文章
    </p>

    <!-- 瀑布流模式：触底懒加载 -->
    <template v-if="displayMode === 'waterfall'">
      <div v-if="hasMore && loading" class="post-list__loader">
        <Icon name="lucide:loader-2" size="20" class="post-list__spinner" />
        <span class="post-list__loader-text">加载中...</span>
      </div>
      <div v-if="hasMore && !loading" ref="sentinelRef" class="post-list__sentinel" />
      <div v-if="!hasMore && filteredPosts.length > 0" class="post-list__end">
        <span class="post-list__end-line" />
        <span class="post-list__end-text">已经到底了</span>
        <span class="post-list__end-line" />
      </div>
    </template>

    <!-- 分页模式：底部分页控件 -->
    <div v-if="displayMode === 'pagination' && totalPages > 1" class="pagination">
      <button
        class="pagination__btn"
        :disabled="currentPage <= 1"
        @click="goToPage(currentPage - 1)"
      >
        <Icon name="lucide:chevron-left" size="16" />
      </button>

      <template v-for="page in pageList" :key="page">
        <span v-if="page === '...'" class="pagination__ellipsis">...</span>
        <button
          v-else
          class="pagination__btn pagination__page"
          :class="{ 'pagination__page--active': page === currentPage }"
          @click="goToPage(page as number)"
        >
          {{ page }}
        </button>
      </template>

      <button
        class="pagination__btn"
        :disabled="currentPage >= totalPages"
        @click="goToPage(currentPage + 1)"
      >
        <Icon name="lucide:chevron-right" size="16" />
      </button>

      <span class="pagination__info">{{ currentPage }} / {{ totalPages }}</span>
    </div>
  </CommonCustomScrollbar>
</template>

<script setup lang="ts">
import type { PostItem } from '~/features/post/types'

const PAGE_SIZE = 15

const props = withDefaults(defineProps<{
  posts: PostItem[]
  activeTab: string
  displayMode?: 'waterfall' | 'pagination'
}>(), {
  displayMode: 'waterfall',
})

const scrollbarRef = ref<{ viewport: HTMLElement | null; scrollToTop: (smooth?: boolean) => void } | null>(null)

const filteredPosts = computed(() => {
  if (props.activeTab === 'all') return props.posts
  return props.posts.filter(p => p.category === props.activeTab)
})

// ---- 瀑布流模式状态 ----
const displayCount = ref(PAGE_SIZE)
const loading = ref(false)
const sentinelRef = ref<HTMLElement | null>(null)

// ---- 分页模式状态 ----
const currentPage = ref(1)

const totalPages = computed(() =>
  Math.ceil(filteredPosts.value.length / PAGE_SIZE),
)

// 根据显示模式切换不同的数据切片策略
const displayedPosts = computed(() => {
  if (props.displayMode === 'pagination') {
    const start = (currentPage.value - 1) * PAGE_SIZE
    return filteredPosts.value.slice(start, start + PAGE_SIZE)
  }
  return filteredPosts.value.slice(0, displayCount.value)
})

const hasMore = computed(() =>
  displayCount.value < filteredPosts.value.length,
)

// 生成分页页码列表（含省略号）
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

// Tab 切换或显示模式切换时重置状态
watch(() => props.activeTab, () => {
  displayCount.value = PAGE_SIZE
  currentPage.value = 1
  scrollbarRef.value?.scrollToTop(false)
})

watch(() => props.displayMode, () => {
  displayCount.value = PAGE_SIZE
  currentPage.value = 1
  scrollbarRef.value?.scrollToTop(false)
})

function loadMore() {
  if (loading.value || !hasMore.value) return
  loading.value = true
  setTimeout(() => {
    displayCount.value = Math.min(
      displayCount.value + PAGE_SIZE,
      filteredPosts.value.length,
    )
    loading.value = false
  }, 400)
}

// ---- IntersectionObserver（仅瀑布流模式使用） ----
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
  // 如果 viewport 没有产生溢出滚动，说明页面使用窗口滚动（如双栏/单栏主题），回退到 null
  if (root.scrollHeight <= root.clientHeight + 1) return null
  return root
}

function setupObserver() {
  observer?.disconnect()
  if (props.displayMode !== 'waterfall') return

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        loadMore()
      }
    },
    {
      root: getObserverRoot(),
      rootMargin: '0px 0px 200px 0px',
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

// viewport 可能晚于 onMounted 就绪（如 Teleport 影响挂载顺序），就绪后重建 observer
watch(
  () => [getScrollRoot(), sentinelRef.value] as const,
  ([root, sentinel]) => {
    if (root && sentinel) {
      setupObserver()
    }
  },
  { immediate: true },
)

// 显示模式切换时重建/销毁 observer
watch(() => props.displayMode, () => {
  if (props.displayMode === 'waterfall') {
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
})
</script>

<style lang="scss" scoped>
/* 外层容器：重置 .main-content__body 自带的 padding，将间距交给视口层控制 */
.main-content__body {
  padding: 0;
  gap: 0;
}

/* 视口层：承载实际的内边距 */
:deep(.post-list-viewport) {
  padding: 1rem 1rem 0;

  @media (min-width: $breakpoint-sm) {
    padding: 1.5rem 1.5rem 0;
  }

  @media (min-width: 1280px) {
    padding: 1rem 2rem 0;
  }
}

.post-list {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.post-list__empty {
  text-align: center;
  padding: 3rem 0;
  color: var(--text-soft);
  font-size: 0.875rem;
}

.post-list__loader {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  padding: 1.5rem 0;
}

.post-list__spinner {
  color: var(--text-soft);
  animation: spin 1.2s linear infinite;
}

.post-list__loader-text {
  color: var(--text-soft);
  font-size: 0.8125rem;
}

.post-list__sentinel {
  height: 1px;
}

.post-list__end {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 2rem 1rem;
}

.post-list__end-line {
  flex: 1;
  height: 1px;
  background-color: var(--border-soft);
}

.post-list__end-text {
  color: var(--text-soft);
  font-size: 0.8125rem;
  white-space: nowrap;
}

/* ---- 分页控件 ---- */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 1.5rem 0 2rem;
  flex-wrap: wrap;
}

.pagination__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  height: 2rem;
  padding: 0 0.25rem;
  border-radius: $radius-sm;
  color: var(--text-soft);
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    color: var(--text-main);
    background: var(--surface-2);
    border-color: var(--border);
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
}

.pagination__page {
  font-size: 0.8125rem;
  font-weight: 500;

  &--active {
    color: var(--accent);
    background: var(--accent-soft);
    border-color: var(--accent-soft);

    &:hover {
      color: var(--accent);
      background: var(--accent-soft);
      border-color: var(--accent-soft);
    }
  }
}

.pagination__ellipsis {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 2rem;
  color: var(--text-soft);
  font-size: 0.8125rem;
  user-select: none;
}

.pagination__info {
  color: var(--text-soft);
  font-size: 0.75rem;
  margin-left: 0.75rem;
  white-space: nowrap;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
