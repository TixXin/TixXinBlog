<!--
  @file PostCardList.vue
  @description 文章列表组件，按当前选中 Tab 过滤并渲染文章列表项，支持瀑布流懒加载与分页两种显示模式
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="post-card-list-root">
    <CommonCustomScrollbar
      ref="scrollbarRef"
      class="main-content__body"
      viewport-class="post-list-viewport"
      :show-progress="displayMode === 'waterfall'"
      :show-back-to-top="false"
      primary
    >

    <!-- 瀑布流模式：TransitionGroup 实现新卡片渐入动画 -->
    <TransitionGroup
      v-if="displayMode === 'waterfall'"
      tag="div"
      class="post-list"
      name="post-enter"
      :css="false"
      @enter="onItemEnter"
    >
      <ThemeComponent
        v-for="(post, index) in displayedPosts"
        :key="post.id"
        name="PostCard"
        :post="post"
        :data-index="index"
      />
    </TransitionGroup>

    <!-- 分页模式：Transition 实现翻页淡入淡出 -->
    <Transition v-else name="page-fade" mode="out-in">
      <div :key="paginationKey" class="post-list">
        <ThemeComponent
          v-for="post in displayedPosts"
          :key="post.id"
          name="PostCard"
          :post="post"
        />
      </div>
    </Transition>

    <p v-if="filteredPosts.length === 0" class="post-list__empty">
      暂无相关文章
    </p>

    <!-- 瀑布流模式：触底懒加载 -->
    <template v-if="displayMode === 'waterfall'">
      <!-- 哨兵始终存在（不受 loading 影响），避免 observer 反复断开重连 -->
      <div v-if="hasMore" ref="sentinelRef" class="post-list__sentinel" />
      <Transition name="loader-fade">
        <div v-if="hasMore && showSpinner" class="post-list__loader">
          <Icon name="lucide:loader-2" size="20" class="post-list__spinner" />
          <span class="post-list__loader-text">加载中...</span>
        </div>
      </Transition>
      <Transition name="loader-fade">
        <div v-if="!hasMore && filteredPosts.length > 0" class="post-list__end">
          <span class="post-list__end-line" />
          <span class="post-list__end-text">已经到底了</span>
          <span class="post-list__end-line" />
        </div>
      </Transition>
    </template>

  </CommonCustomScrollbar>

  <!-- 分页模式：悬浮在主内容区底部，向下滚动隐藏，向上滚动显示 -->
  <Transition name="pagination-slide">
    <div v-if="displayMode === 'pagination' && totalPages > 1 && paginationVisible" class="pagination-bar">
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
  </Transition>
  </div>
</template>

<script setup lang="ts">
import type { PostItem } from '~/features/post/types'

const props = withDefaults(defineProps<{
  posts: PostItem[]
  activeTab: string
  displayMode?: 'waterfall' | 'pagination'
}>(), {
  displayMode: 'waterfall',
})

const scrollbarRef = ref<{ viewport: HTMLElement | null; scrollToTop: (smooth?: boolean) => void } | null>(null)

const {
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
} = usePostListPagination({
  posts: toRef(props, 'posts'),
  activeTab: toRef(props, 'activeTab'),
  displayMode: toRef(props, 'displayMode'),
  scrollbarRef,
})

const { onItemEnter } = usePostListAnimation(displayCount)

// ---- 滚动方向检测：向下隐藏分页，向上显示分页（受界面设置开关控制） ----
const { paginationAutoHide } = useAppearanceSettings()
const paginationVisible = ref(true)
let lastScrollTop = 0

function onViewportScroll() {
  if (!paginationAutoHide.value) return
  const viewport = scrollbarRef.value?.viewport
  if (!viewport) return
  const { scrollTop } = viewport
  // 向上滚动 → 显示，向下滚动 → 隐藏
  if (scrollTop < lastScrollTop || scrollTop <= 10) {
    paginationVisible.value = true
  } else if (scrollTop > lastScrollTop && scrollTop > 50) {
    paginationVisible.value = false
  }
  lastScrollTop = scrollTop
}

// 关闭自动隐藏时，立即恢复分页栏显示
watch(paginationAutoHide, (enabled) => {
  if (!enabled) paginationVisible.value = true
})

onMounted(() => {
  // 监听 scrollbar viewport 的滚动事件
  watch(
    () => scrollbarRef.value?.viewport,
    (vp, oldVp) => {
      oldVp?.removeEventListener('scroll', onViewportScroll)
      vp?.addEventListener('scroll', onViewportScroll, { passive: true })
    },
    { immediate: true },
  )
})

onUnmounted(() => {
  scrollbarRef.value?.viewport?.removeEventListener('scroll', onViewportScroll)
})
</script>

<style lang="scss" scoped>
/* 根容器：撑满父级，支持分页悬浮 */
.post-card-list-root {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  position: relative;
}

/* 外层容器：重置 .main-content__body 自带的 padding，将间距交给视口层控制 */
.main-content__body {
  padding: 0;
  gap: 0;
}

/* 视口层：承载实际的内边距，底部留出悬浮分页栏空间 */
:deep(.post-list-viewport) {
  padding: 1rem 1rem 3.5rem;

  @media (min-width: $breakpoint-sm) {
    padding: 1.5rem 1.5rem 3.5rem;
  }

  @media (min-width: $breakpoint-xl) {
    padding: 1rem 2rem 3.5rem;
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

/* ---- 分页翻页过渡 ---- */
.page-fade-enter-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.page-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.page-fade-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ---- 加载指示器渐隐渐现 ---- */
.loader-fade-enter-active,
.loader-fade-leave-active {
  transition: opacity 0.25s ease;
}

.loader-fade-enter-from,
.loader-fade-leave-to {
  opacity: 0;
}

/* ---- 悬浮分页栏 ---- */
.pagination-bar {
  position: absolute;
  bottom: 0.75rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.25rem 0.75rem;
  background: color-mix(in srgb, var(--surface-1) 72%, transparent);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border);
  border-radius: $radius-full;
  box-shadow: var(--shadow-card);
  flex-wrap: nowrap;
  white-space: nowrap;
}

.pagination__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 1.625rem;
  height: 1.625rem;
  padding: 0 0.125rem;
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
  font-size: 0.75rem;
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
  min-width: 1rem;
  height: 1.625rem;
  color: var(--text-soft);
  font-size: 0.75rem;
  user-select: none;
}

.pagination__info {
  color: var(--text-soft);
  font-size: 0.6875rem;
  margin-left: 0.5rem;
  white-space: nowrap;
}

/* ---- 分页栏滑动动画：向上弹出显示 / 向下退出隐藏 ---- */
.pagination-slide-enter-active {
  transition: opacity 0.25s ease-out, transform 0.25s ease-out;
}

.pagination-slide-leave-active {
  transition: opacity 0.2s ease-in, transform 0.2s ease-in;
}

.pagination-slide-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(100%);
}

.pagination-slide-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(100%);
}

</style>
