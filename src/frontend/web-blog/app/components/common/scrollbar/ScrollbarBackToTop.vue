<!-- @file ScrollbarBackToTop.vue @description 自定义滚动条悬浮的返回顶部与滚动进度百分比按钮 -->
<template>
  <Transition name="back-to-top">
    <div v-if="visible" class="custom-scrollbar__back-to-top">
      <CommonTooltip :content="$t('layout.scrollbar.backToTop')" placement="left">
        <button
          type="button"
          class="custom-scrollbar__back-to-top-btn"
          :class="{ 'is-clicked': clicked }"
          :aria-label="$t('layout.scrollbar.backToTop')"
          @click="emit('click')"
        >
          <span class="custom-scrollbar__progress-text">{{ displayProgress }}%</span>
          <Icon name="lucide:arrow-up" size="16" class="custom-scrollbar__progress-icon" />
        </button>
      </CommonTooltip>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  progress: number
  clicked: boolean
}>()

const emit = defineEmits<{
  (e: 'click'): void
}>()

const displayProgress = computed(() => Math.round(props.progress))
</script>

<style lang="scss" scoped>
.custom-scrollbar__back-to-top {
  position: absolute;
  bottom: 20px;
  right: 20px;
  z-index: 20;

  @media (max-width: #{$breakpoint-sm - 0.02}) {
    bottom: 16px;
    right: 16px;
  }
}

.custom-scrollbar__back-to-top-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.75rem;
  height: 2.25rem;
  padding: 0.25rem 0.625rem;
  border-radius: $radius-full;
  border: 1px solid var(--border);
  background: var(--surface-1-alpha);
  backdrop-filter: blur(12px);
  color: var(--text-soft);
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  cursor: var(--interaction-cursor, pointer);
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.15s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--accent-text);
    background: var(--surface-2);
    border-color: var(--border-hover);
    box-shadow: var(--shadow-card);

    .custom-scrollbar__progress-text {
      opacity: 0;
      transform: scale(0.6);
    }

    .custom-scrollbar__progress-icon {
      opacity: 1;
      transform: translateY(0);
      animation: scrollbar-progress-bounce 0.6s ease infinite;
      @media (prefers-reduced-motion: reduce) {
        animation: none;
      }
    }
  }

  &:active {
    transform: scale(0.95);
  }

  // 点击回顶后 hover 不再切换图标
  &.is-clicked:hover {
    .custom-scrollbar__progress-text {
      opacity: 1;
      transform: none;
    }

    .custom-scrollbar__progress-icon {
      opacity: 0;
      transform: translateY(4px);
      animation: none;
    }
  }

  @media (max-width: #{$breakpoint-sm - 0.02}) {
    min-width: 2.5rem;
    height: 2rem;
    font-size: 0.6875rem;
  }
}

.custom-scrollbar__progress-text {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.custom-scrollbar__progress-icon {
  position: absolute;
  opacity: 0;
  transform: translateY(4px);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

@keyframes scrollbar-progress-bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-3px);
  }
  60% {
    transform: translateY(1px);
  }
}

.back-to-top-enter-active {
  transition:
    opacity 0.25s ease-out,
    transform 0.25s ease-out;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.back-to-top-leave-active {
  transition:
    opacity 0.2s ease-in,
    transform 0.2s ease-in;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.back-to-top-enter-from,
.back-to-top-leave-to {
  opacity: 0;
  transform: scale(0.8) translateY(8px);
}
</style>
