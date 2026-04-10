<!--
  @file PinnedMessage.vue
  @description 留言板置顶公告消息栏
  @author TixXin
  @since 2026-04-10
-->

<template>
  <div v-if="!dismissed" class="pinned-message">
    <div class="pinned-message__indicator" />
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
.pinned-message {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 1rem;
  background: color-mix(in srgb, var(--accent, #5b7cfa) 6%, var(--surface-1));
  border-bottom: 1px solid var(--border-soft);
  position: relative;
  overflow: hidden;
}

.pinned-message__indicator {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--accent, #5b7cfa);
  border-radius: 0 2px 2px 0;
}

.pinned-message__icon {
  flex-shrink: 0;
  color: var(--accent, #5b7cfa);
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
  color: var(--accent, #5b7cfa);
  padding: 0.0625rem 0.375rem;
  border-radius: 3px;
  background: color-mix(in srgb, var(--accent, #5b7cfa) 12%, transparent);
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
  width: 1.5rem;
  height: 1.5rem;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: var(--text-faint);
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: var(--surface-2);
    color: var(--text-soft);
  }
}
</style>
