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

  @media (min-width: $breakpoint-xl) {
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

</style>
