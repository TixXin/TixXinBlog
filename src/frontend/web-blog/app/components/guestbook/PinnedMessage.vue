<!--
  @file PinnedMessage.vue
  @description 留言板置顶公告消息栏
  @author TixXin
  @since 2026-04-10
-->

<template>
  <div v-if="!dismissed" class="pinned-message">
    <Icon name="lucide:pin" size="14" class="pinned-message__icon" />
    <div class="pinned-message__body">
      <span class="pinned-message__label">置顶</span>
      <p class="pinned-message__content">
        {{ message.content }}
      </p>
    </div>
    <button type="button" class="pinned-message__close" aria-label="关闭公告" @click="dismissed = true">
      <Icon name="lucide:x" size="14" />
    </button>
  </div>
</template>

<script setup lang="ts">
import type { PinnedMessage } from '~/features/guestbook/types'

defineProps<{
  message: PinnedMessage
}>()

const dismissed = ref(false)
</script>

<style lang="scss" scoped>
// 页头内的整宽圆角条，用主题柔和强调色区分，不加重边框
.pinned-message {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-width: 0;
  padding: 0.375rem 0.375rem 0.375rem 0.875rem;
  background: var(--surface-2);
  border-radius: $radius-md;
}

.pinned-message__icon {
  flex-shrink: 0;
  color: var(--accent-text);
  transform: rotate(45deg);
}

.pinned-message__body {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pinned-message__label {
  flex-shrink: 0;
  font-size: 0.625rem;
  font-weight: 700;
  color: var(--accent-text);
  padding: 0.0625rem 0.375rem;
  border-radius: 0.25rem;
  background: var(--accent-soft);
}

.pinned-message__content {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-soft);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pinned-message__close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: var(--text-faint);
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    background: var(--surface-2);
    color: var(--text-soft);
  }
}
</style>
