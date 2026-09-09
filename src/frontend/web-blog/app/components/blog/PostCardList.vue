<!--
  @file PostCardList.vue
  @description 文章列表组件，按当前选中 Tab 过滤并渲染文章列表项，支持瀑布流懒加载与分页两种显示模式
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="post-card-list-root">
    <div v-if="posts.length && (pending || errorMessage)" class="post-list-feedback">
      <p v-if="pending" role="status">正在加载文章…</p>
      <div v-else role="alert">
        {{ errorMessage }}<span v-if="posts.length">，已保留原列表。</span>
        <button type="button" @click="$emit('retry')">重试</button>
      </div>
    </div>
    <CommonCustomScrollbar
      ref="scrollbarRef"
      class="main-content__body"
      viewport-class="post-list-viewport"
      :show-progress="displayMode === 'waterfall'"
      :show-back-to-top="false"
      :aria-busy="pending"
      primary
    >
      <CommonRequestFeedback
        v-if="!posts.length && (pending || errorMessage)"
        :pending="pending"
        :title="errorMessage || '正在加载文章'"
        description="暂时无法获取文章内容，请稍后重试。"
        @retry="$emit('retry')"
      />
      <!-- 瀑布流模式：TransitionGroup 实现新卡片渐入动画 -->
      <TransitionGroup
        v-if="displayMode === 'waterfall'"
        tag="div"
        class="post-list"
        name="post-enter"
        :css="false"
        @enter="onItemEnter"
        @enter-cancelled="onItemEnterCancelled"
      >
        <ThemeComponent
          v-for="(post, index) in displayedPosts"
          :key="post.id"
          name="PostCard"
          :post="post"
          :data-index="index"
        />
      </TransitionGroup>

      <!-- 保持容器稳定，仅在已接受的新文章到齐后播放可取消过渡。 -->
      <div v-else ref="pageListRef" class="post-list">
        <ThemeComponent v-for="post in displayedPosts" :key="post.id" name="PostCard" :post="post" />
      </div>

      <p v-if="!pending && !errorMessage && filteredPosts.length === 0" class="post-list__empty">暂无相关文章</p>

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
          <div v-if="!hasMore && !pending && !errorMessage && filteredPosts.length > 0" class="post-list__end">
            <span class="post-list__end-line" />
            <span class="post-list__end-text">已经到底了</span>
            <span class="post-list__end-line" />
          </div>
        </Transition>
      </template>
    </CommonCustomScrollbar>

    <!-- 分页模式：悬浮在主内容区底部，向下滚动隐藏，向上滚动显示 -->
    <Transition name="pagination-slide">
      <nav
        v-if="displayMode === 'pagination' && totalPages > 1 && paginationVisible"
        aria-label="文章分页"
        class="pagination-bar"
        :class="{ 'is-bounced': paginationBounce }"
      >
        <button
          type="button"
          aria-label="上一页"
          class="pagination__btn"
          :disabled="currentPage <= 1"
          @click="goToPage(currentPage - 1)"
        >
          <Icon name="lucide:chevron-left" size="16" />
        </button>

        <template v-for="(page, index) in pageList" :key="`${page}-${index}`">
          <span v-if="page === '...'" class="pagination__ellipsis">...</span>
          <button
            v-else
            type="button"
            :aria-current="page === currentPage ? 'page' : undefined"
            class="pagination__btn pagination__page"
            :class="{ 'pagination__page--active': page === currentPage }"
            @click="goToPage(page as number)"
          >
            {{ page }}
          </button>
        </template>

        <button
          type="button"
          aria-label="下一页"
          class="pagination__btn"
          :disabled="currentPage >= totalPages"
          @click="goToPage(currentPage + 1)"
        >
          <Icon name="lucide:chevron-right" size="16" />
        </button>

        <span class="pagination__info">{{ currentPage }} / {{ totalPages }}</span>
      </nav>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type { PostItem } from '~/features/post/types'

const props = withDefaults(
  defineProps<{
    posts: PostItem[]
    activeTab: string
    total: number
    currentPage: number
    pending: boolean
    errorMessage?: string
    displayMode?: 'waterfall' | 'pagination'
    /** 按标签名过滤 */
    selectedTag?: string | null
    /** 按分类名过滤 */
    selectedCategory?: string | null
  }>(),
  {
    displayMode: 'waterfall',
    errorMessage: '',
    selectedTag: null,
    selectedCategory: null,
  },
)

const emit = defineEmits<{ page: [page: number]; retry: [] }>()

const scrollbarRef = ref<{ viewport: HTMLElement | null; scrollToTop: (smooth?: boolean) => void } | null>(null)
const pageListRef = ref<HTMLElement | null>(null)
usePostPageMotion(pageListRef, toRef(props, 'posts'), toRef(props, 'displayMode'))

const {
  filteredPosts,
  displayedPosts,
  displayCount,
  hasMore,
  showSpinner,
  sentinelRef,
  currentPage,
  totalPages,
  pageList,
  goToPage,
} = usePostListPagination({
  posts: toRef(props, 'posts'),
  total: toRef(props, 'total'),
  currentPage: toRef(props, 'currentPage'),
  pending: toRef(props, 'pending'),
  error: toRef(props, 'errorMessage'),
  requestPage: (page) => emit('page', page),
  displayMode: toRef(props, 'displayMode'),
  scrollbarRef,
})

const { onItemEnter, onItemEnterCancelled } = usePostListAnimation(displayCount)

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

// ---- 底部栏展开时分页栏弹跳 ----
const { isFooterExpanded } = useFooterExpand()
const paginationBounce = ref(false)
const { reducedMotion } = useMotionPreference()
let bounceTimer: ReturnType<typeof setTimeout> | undefined

watch(isFooterExpanded, (expanded) => {
  if (expanded) {
    if (bounceTimer) clearTimeout(bounceTimer)
    paginationBounce.value = !reducedMotion.value
    bounceTimer = setTimeout(() => {
      paginationBounce.value = false
    }, 500)
  }
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
  if (bounceTimer) clearTimeout(bounceTimer)
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

// 状态提示不参与列表排版，避免请求开始和结束时内容上下跳动。
.post-list-feedback {
  position: absolute;
  top: 0.5rem;
  right: 1rem;
  z-index: 3;
  max-width: calc(100% - 2rem);
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: $radius-md;
  background: var(--surface-1);
  color: var(--text-soft);
  font-size: 0.8125rem;
  box-shadow: var(--shadow-card);
  pointer-events: none;

  p {
    margin: 0;
  }
  button {
    min-height: 44px;
    margin-left: 0.5rem;
    padding: 0 0.5rem;
    color: var(--accent-text);
    pointer-events: auto;
  }
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

  // 紧凑档（lg–xl）：与 main-content__body 的 1.25rem padding 对齐
  @media (min-width: $breakpoint-lg) and (max-width: #{$breakpoint-xl - 1px}) {
    padding: 1rem 1.25rem 3.5rem;
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
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
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

/* ---- 加载指示器渐隐渐现 ---- */
.loader-fade-enter-active,
.loader-fade-leave-active {
  transition: opacity 0.25s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
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
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

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
    color: var(--accent-text);
    background: var(--accent-soft);
    border-color: var(--accent-soft);

    &:hover {
      color: var(--accent-text);
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

/* ---- 分页栏弹跳（底部栏展开时联动） ---- */
.pagination-bar.is-bounced {
  animation: pagination-bump 0.5s cubic-bezier(0.22, 0.68, 0.35, 1);
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

@keyframes pagination-bump {
  0% {
    transform: translateX(-50%) translateY(0);
  }
  30% {
    transform: translateX(-50%) translateY(-24px);
  }
  55% {
    transform: translateX(-50%) translateY(4px);
  }
  75% {
    transform: translateX(-50%) translateY(-6px);
  }
  100% {
    transform: translateX(-50%) translateY(0);
  }
}

/* ---- 分页栏滑动动画：向上弹出显示 / 向下退出隐藏 ---- */
.pagination-slide-enter-active {
  transition:
    opacity 0.25s ease-out,
    transform 0.25s ease-out;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.pagination-slide-leave-active {
  transition:
    opacity 0.2s ease-in,
    transform 0.2s ease-in;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
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
