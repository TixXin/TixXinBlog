<!--
  @file MessageInputReplyBar.vue
  @description 留言输入框悬浮回复引用条，支持向上与向下悬浮展示及取消回复
  @author TixXin
  @since 2026-10-21
-->

<template>
  <Transition name="reply-fade">
    <div
      v-if="replyTo"
      class="message-input__reply-bar"
      :class="{ 'message-input__reply-bar--below': placement === 'below' }"
    >
      <Icon name="lucide:reply" size="13" class="message-input__reply-icon" />
      <span class="message-input__reply-label">{{ $t('interaction.guestbookInput.replyLabel') }}</span>
      <span class="message-input__reply-author">{{ replyTo.author }}</span>
      <span class="message-input__reply-text">{{ replyTo.content }}</span>
      <button
        type="button"
        class="message-input__reply-close"
        :aria-label="$t('interaction.guestbookInput.cancelReply')"
        @click="$emit('cancelReply')"
      >
        <Icon name="lucide:x" size="14" />
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { ReplyRef } from '~/features/guestbook/types'

defineProps<{
  replyTo?: ReplyRef | null
  placement?: 'above' | 'below'
}>()

defineEmits<{
  cancelReply: []
}>()
</script>

<style lang="scss" scoped>
/* ---- 回复引用：悬浮在输入卡片外，不占列表高度 ---- */
.message-input__reply-bar {
  position: absolute;
  z-index: 3;
  left: 0;
  right: 0;
  bottom: calc(100% + 0.375rem);
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4375rem 0.75rem;
  border: 1px solid var(--border-soft);
  border-radius: calc(#{$radius-card} - 0.5rem);
  background: color-mix(in srgb, var(--accent, #5b7cfa) 8%, var(--surface-1));
  box-shadow: var(--shadow-card);
  backdrop-filter: blur(10px);

  &--below {
    top: calc(100% + 0.375rem);
    bottom: auto;
  }
}

.message-input__reply-icon {
  flex-shrink: 0;
  color: var(--accent, #5b7cfa);
}

.message-input__reply-label {
  flex-shrink: 0;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--accent, #5b7cfa);
}

.message-input__reply-author {
  flex-shrink: 0;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-soft);
}

.message-input__reply-text {
  flex: 1;
  min-width: 0;
  font-size: 0.6875rem;
  color: var(--text-faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-input__reply-close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
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

.reply-fade-enter-active,
.reply-fade-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.reply-fade-enter-from,
.reply-fade-leave-to {
  opacity: 0;
  transform: translateY(0.375rem);
}

.message-input__reply-bar--below.reply-fade-enter-from,
.message-input__reply-bar--below.reply-fade-leave-to {
  transform: translateY(-0.375rem);
}
</style>
