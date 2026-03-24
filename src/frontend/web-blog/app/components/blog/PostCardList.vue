<!--
  @file PostCardList.vue
  @description 文章列表组件，按当前选中 Tab 过滤并渲染文章列表项，支持懒加载分页与自定义滚动条
  @author TixXin
  @since 2025-03-17
-->

<template>
    <CommonCustomScrollbar
      ref="scrollbarRef"
      class="main-content__body"
      viewport-class="post-list-viewport"
      show-progress
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

    <!-- 加载中 -->
    <div v-if="hasMore && loading" class="post-list__loader">
      <Icon name="lucide:loader-2" size="20" class="post-list__spinner" />
      <span class="post-list__loader-text">加载中...</span>
    </div>

    <!-- 哨兵元素：触发触底加载 -->
    <div v-if="hasMore && !loading" ref="sentinelRef" class="post-list__sentinel" />

    <!-- 已加载完毕 -->
    <div v-if="!hasMore && filteredPosts.length > 0" class="post-list__end">
      <span class="post-list__end-line" />
      <span class="post-list__end-text">已经到底了</span>
      <span class="post-list__end-line" />
    </div>
  </CommonCustomScrollbar>
</template>

<script setup lang="ts">
import type { PostItem } from '~/features/post/types'

const PAGE_SIZE = 10

const props = defineProps<{
  posts: PostItem[]
  activeTab: string
}>()

const scrollbarRef = ref<{ viewport: HTMLElement | null; scrollToTop: (smooth?: boolean) => void } | null>(null)

const filteredPosts = computed(() => {
  if (props.activeTab === 'all') return props.posts
  return props.posts.filter(p => p.category === props.activeTab)
})

const displayCount = ref(PAGE_SIZE)
const loading = ref(false)
const sentinelRef = ref<HTMLElement | null>(null)

const displayedPosts = computed(() =>
  filteredPosts.value.slice(0, displayCount.value),
)

const hasMore = computed(() =>
  displayCount.value < filteredPosts.value.length,
)

// Tab 切换时重置分页并滚动到顶部
watch(() => props.activeTab, () => {
  displayCount.value = PAGE_SIZE
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
  return getScrollRoot()
}

function setupObserver() {
  observer?.disconnect()

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

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
