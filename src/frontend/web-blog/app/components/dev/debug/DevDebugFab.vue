<!--
  @file DevDebugFab.vue
  @description Dev 调试面板悬浮入口按钮（FAB）
  @author TixXin
  @since 2026-10-21
-->

<template>
  <button
    class="dev-debug-fab"
    type="button"
    :class="{ 'is-open': isOpen, 'is-dragging': isDragging, 'is-hidden': fabHidden }"
    :style="fabStyle"
    :inert="fabHidden || undefined"
    :aria-label="isOpen ? '关闭 dev 调试面板' : '打开 dev 调试面板'"
    :aria-expanded="isOpen"
    @pointerdown="emit('pointerdown', $event)"
    @click="emit('click')"
  >
    <Icon name="lucide:wrench" size="12" />
    <span>DEV</span>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  isOpen: boolean
  isDragging: boolean
  fabHidden: boolean
  fabStyle: Record<string, string>
}>()

const emit = defineEmits<{
  pointerdown: [event: PointerEvent]
  click: []
}>()
</script>

<style lang="scss" scoped>
.dev-debug-fab {
  position: fixed;
  z-index: 9998;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3rem 0.55rem;
  border: 1px dashed var(--accent);
  border-radius: $radius-full;
  background: var(--accent-alpha-5, rgba(99, 102, 241, 0.08));
  color: var(--accent);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  cursor: var(--interaction-cursor, grab);
  user-select: none;
  touch-action: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &.is-hidden {
    opacity: 0;
    pointer-events: none;
  }

  &:hover {
    background: var(--accent-alpha-20, rgba(99, 102, 241, 0.2));
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.16);
  }

  &.is-open {
    background: var(--accent-alpha-20, rgba(99, 102, 241, 0.2));
    border-style: solid;
  }

  &.is-dragging {
    cursor: var(--interaction-cursor, grabbing);
    transform: scale(0.95);
    transition: none;
  }
}
</style>
