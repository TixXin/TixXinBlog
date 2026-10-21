<!--
  @file DevDebugHeader.vue
  @description Dev 调试面板抽屉头部（标题、缩放、停靠位置与关闭按钮）
  @author TixXin
  @since 2026-10-21
-->

<template>
  <header
    class="dev-debug-drawer__head"
    :class="{ 'is-draggable': position === 'center', 'is-narrow': position === 'left' || position === 'right' }"
    @pointerdown="emit('pointerdown', $event)"
  >
    <Icon name="lucide:wrench" size="14" />
    <h2 class="dev-debug-drawer__title">DEV 调试面板</h2>
    <!-- 面板独立缩放：紧凑 +/- + 当前百分比（点击复位） -->
    <div class="dev-debug-zoom-picker" role="group" aria-label="调整面板缩放">
      <button
        type="button"
        class="dev-debug-zoom-btn"
        title="缩小"
        aria-label="缩小"
        :disabled="fontScale <= FONT_SCALE_MIN + 0.001"
        @click="emit('decreaseZoom')"
      >
        <Icon name="lucide:minus" size="12" />
      </button>
      <button
        type="button"
        class="dev-debug-zoom-value"
        title="复位为 100%"
        aria-label="复位为 100%"
        @click="emit('resetZoom')"
      >
        {{ Math.round(fontScale * 100) }}%
      </button>
      <button
        type="button"
        class="dev-debug-zoom-btn"
        title="放大"
        aria-label="放大"
        :disabled="fontScale >= FONT_SCALE_MAX - 0.001"
        @click="emit('increaseZoom')"
      >
        <Icon name="lucide:plus" size="12" />
      </button>
    </div>
    <!-- 停靠位置切换：5 个图标按钮 -->
    <div class="dev-debug-dock-picker" role="group" aria-label="切换停靠位置">
      <button
        v-for="opt in DOCK_OPTIONS"
        :key="opt.value"
        type="button"
        class="dev-debug-dock-btn"
        :class="{ 'is-active': position === opt.value }"
        :title="opt.label"
        :aria-label="opt.label"
        :aria-pressed="position === opt.value"
        @click="emit('changePosition', opt.value)"
      >
        <Icon :name="opt.icon" size="14" />
      </button>
    </div>
    <button
      type="button"
      class="dev-debug-drawer__close"
      aria-label="关闭 (Esc)"
      title="关闭 (Esc)"
      @click="emit('close')"
    >
      <Icon name="lucide:x" size="16" />
    </button>
  </header>
</template>

<script setup lang="ts">
import type { DevDebugDockPosition } from '~/composables/useDevDebugPanel'
import { FONT_SCALE_MIN, FONT_SCALE_MAX } from '~/composables/useDevDebugPanel'
import { DOCK_OPTIONS } from '~/features/dev/constants'

defineProps<{
  position: DevDebugDockPosition
  fontScale: number
}>()

const emit = defineEmits<{
  pointerdown: [event: PointerEvent]
  decreaseZoom: []
  resetZoom: []
  increaseZoom: []
  changePosition: [position: DevDebugDockPosition]
  close: []
}>()
</script>

<style lang="scss" scoped>
.dev-debug-drawer__head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0.875rem 0.75rem 1rem;
  border-bottom: 1px solid var(--border-soft);
  color: var(--accent);
  flex-shrink: 0;
  user-select: none;

  // 左右停靠时抽屉只有约 320px：标题独占一行，缩放、停靠与关闭按钮换到第二行，避免标题被挤成多行
  &.is-narrow {
    flex-wrap: wrap;
    row-gap: 0.5rem;

    // 扣掉前置图标（14px）与间距，让图标与标题同在第一行
    .dev-debug-drawer__title {
      flex-basis: calc(100% - 14px - 0.5rem);
    }
  }

  &.is-draggable {
    cursor: var(--interaction-cursor, grab);

    &:active {
      cursor: var(--interaction-cursor, grabbing);
    }
  }
}

.dev-debug-drawer__title {
  flex: 1;
  margin: 0;
  white-space: nowrap;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--text-main);
}

/* ==================== 面板独立缩放 ==================== */
.dev-debug-zoom-picker {
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  padding: 0.125rem;
  border: 1px solid var(--border-soft);
  border-radius: $radius-sm;
  background: var(--surface-2);
  margin-right: 0.25rem;
}

.dev-debug-zoom-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.375rem;
  height: 1.375rem;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-soft);
  border-radius: $radius-sm;
  cursor: var(--interaction-cursor, pointer);
  transition:
    background 0.18s ease,
    color 0.18s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover:not(:disabled) {
    color: var(--text-main);
    background: var(--surface-3);
  }

  &:disabled {
    opacity: 0.35;
    cursor: var(--interaction-cursor, not-allowed);
  }
}

.dev-debug-zoom-value {
  min-width: 2.4rem;
  height: 1.375rem;
  padding: 0 0.25rem;
  border: none;
  background: transparent;
  color: var(--text-main);
  font-size: 0.625rem;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  border-radius: $radius-sm;
  cursor: var(--interaction-cursor, pointer);
  transition:
    background 0.18s ease,
    color 0.18s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    background: var(--surface-3);
    color: var(--accent);
  }
}

/* ==================== 停靠位置切换 ==================== */
.dev-debug-dock-picker {
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  padding: 0.125rem;
  border: 1px solid var(--border-soft);
  border-radius: $radius-sm;
  background: var(--surface-2);
  margin-right: 0.25rem;
}

.dev-debug-dock-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.375rem;
  height: 1.375rem;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-soft);
  border-radius: $radius-sm;
  cursor: var(--interaction-cursor, pointer);
  transition:
    background 0.18s ease,
    color 0.18s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--text-main);
    background: var(--surface-3);
  }

  &.is-active {
    color: var(--accent);
    background: var(--accent-alpha-20, rgba(99, 102, 241, 0.2));
  }
}

.dev-debug-drawer__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  background: transparent;
  border-radius: $radius-full;
  color: var(--text-soft);
  cursor: var(--interaction-cursor, pointer);
  transition:
    background 0.2s ease,
    color 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    background: var(--surface-2);
    color: var(--text-main);
  }
}
</style>
