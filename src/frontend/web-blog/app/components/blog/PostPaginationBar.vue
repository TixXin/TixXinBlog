<!-- @file PostPaginationBar.vue @description 文章列表分页模式下的悬浮分页控制栏，支持滚动自动隐藏与页脚展开弹跳 -->
<template>
  <!-- 分页模式：悬浮在主内容区底部，向下滚动隐藏，向上滚动显示 -->
  <Transition name="pagination-slide">
    <nav
      v-if="totalPages > 1 && visible"
      :aria-label="$t('article.list.paginationLabel')"
      class="pagination-bar"
      :class="{ 'is-bounced': paginationBounce }"
    >
      <button
        type="button"
        :aria-label="$t('article.pagination.previous')"
        class="pagination__btn"
        :disabled="currentPage <= 1"
        @click="emit('page', currentPage - 1)"
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
          @click="emit('page', page as number)"
        >
          {{ page }}
        </button>
      </template>

      <button
        type="button"
        :aria-label="$t('article.pagination.next')"
        class="pagination__btn"
        :disabled="currentPage >= totalPages"
        @click="emit('page', currentPage + 1)"
      >
        <Icon name="lucide:chevron-right" size="16" />
      </button>

      <span class="pagination__info">{{ currentPage }} / {{ totalPages }}</span>
    </nav>
  </Transition>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    currentPage: number
    totalPages: number
    pageList: (string | number)[]
    visible?: boolean
  }>(),
  {
    visible: true,
  },
)

const emit = defineEmits<{
  (e: 'page', page: number): void
}>()

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

onUnmounted(() => {
  if (bounceTimer) clearTimeout(bounceTimer)
})
</script>

<style scoped lang="scss">
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
  cursor: var(--interaction-cursor, pointer);
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
    cursor: var(--interaction-cursor, not-allowed);
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
