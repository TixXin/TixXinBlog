<!--
  @file PostCardList.vue
  @description 文章列表组件，按当前选中 Tab 过滤并渲染文章列表项，支持瀑布流懒加载与分页两种显示模式
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="post-card-list-root">
    <div v-if="posts.length && (pending || errorMessage)" class="post-list-feedback">
      <p v-if="pending" role="status">{{ $t('article.list.loadingEllipsis') }}</p>
      <CommonRequestFeedback
        v-else
        class="post-list-feedback__error"
        compact
        :title="errorMessage"
        :description="$t('article.list.keptPrevious')"
        @retry="$emit('retry')"
      />
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
        :title="errorMessage || $t('article.list.loading')"
        :description="$t('article.list.loadFailedDescription')"
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
          :priority="index < 2"
        />
      </TransitionGroup>

      <!-- 保持容器稳定，仅在已接受的新文章到齐后播放可取消过渡。 -->
      <div v-else ref="pageListRef" class="post-list">
        <ThemeComponent
          v-for="(post, index) in displayedPosts"
          :key="post.id"
          name="PostCard"
          :post="post"
          :priority="index < 2"
        />
      </div>

      <p v-if="!pending && !errorMessage && filteredPosts.length === 0" class="post-list__empty">
        {{ $t('article.list.empty') }}
      </p>

      <!-- 瀑布流模式：触底懒加载 -->
      <template v-if="displayMode === 'waterfall'">
        <!-- 哨兵始终存在（不受 loading 影响），避免 observer 反复断开重连 -->
        <div v-if="hasMore" ref="sentinelRef" class="post-list__sentinel" />
        <Transition name="loader-fade">
          <div v-if="hasMore && showSpinner" class="post-list__loader">
            <Icon name="lucide:loader-2" size="20" class="post-list__spinner" />
            <span class="post-list__loader-text">{{ $t('article.list.loadingMore') }}</span>
          </div>
        </Transition>
        <Transition name="loader-fade">
          <div v-if="!hasMore && !pending && !errorMessage && filteredPosts.length > 0" class="post-list__end">
            <span class="post-list__end-line" />
            <span class="post-list__end-text">{{ $t('article.list.end') }}</span>
            <span class="post-list__end-line" />
          </div>
        </Transition>
      </template>
    </CommonCustomScrollbar>

    <!-- 分页模式：悬浮在主内容区底部 -->
    <BlogPostPaginationBar
      v-if="displayMode === 'pagination'"
      :current-page="currentPage"
      :total-pages="totalPages"
      :page-list="pageList"
      :visible="paginationVisible"
      @page="goToPage"
    />
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

watch(
  () => scrollbarRef.value?.viewport,
  (viewport, oldViewport) => {
    oldViewport?.removeEventListener('scroll', onViewportScroll)
    viewport?.addEventListener('scroll', onViewportScroll, { passive: true })
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  scrollbarRef.value?.viewport?.removeEventListener('scroll', onViewportScroll)
})
</script>

<style scoped lang="scss">
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
  &__error {
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
</style>
