<!--
  @file MessageBubbleReply.vue
  @description 留言气泡回复引用卡片，支持原留言跳转与不可用提示
  @author TixXin
  @since 2026-10-21
-->

<template>
  <button
    v-if="message.replyTo"
    type="button"
    class="message-bubble__reply message-bubble__reply--link"
    :class="{ 'message-bubble__reply--end': message.isOwner }"
    :aria-label="
      $t('interaction.guestbookBubble.jumpToReply', {
        author: message.replyTo.author,
        content: message.replyTo.content,
      })
    "
    @click="$emit('jump', { target: message.replyTo.id, from: message.id })"
  >
    <Icon name="lucide:corner-up-right" size="12" class="message-bubble__reply-icon" />
    <span class="message-bubble__reply-author">{{ message.replyTo.author }}</span>
    <span class="message-bubble__reply-content">{{ message.replyTo.content }}</span>
  </button>

  <p v-if="message.replyUnavailable" class="message-bubble__reply">
    {{ $t('interaction.guestbookBubble.replyUnavailable') }}
  </p>
</template>

<script setup lang="ts">
import type { GuestMessage } from '~/features/guestbook/types'

defineProps<{
  message: GuestMessage
}>()

defineEmits<{
  jump: [value: { target: number; from: number }]
}>()
</script>

<style lang="scss" scoped>
/* ---- 回复引用 ---- */
.message-bubble__reply {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.3125rem 0.625rem;
  border-radius: 0.5rem;
  background: var(--surface-2);
  border-left: 2px solid var(--accent, #5b7cfa);
  max-width: 100%;
  overflow: hidden;

  &--end {
    border-left: none;
    border-right: 2px solid var(--accent, #5b7cfa);
  }

  &--link {
    font: inherit;
    text-align: left;
    color: inherit;
    border-top: none;
    border-bottom: none;
    cursor: var(--interaction-cursor, pointer);
    transition: background 0.15s ease;
    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }

    &:hover {
      background: color-mix(in srgb, var(--accent, #5b7cfa) 10%, var(--surface-2));
    }

    &:focus-visible {
      outline: 2px solid var(--accent, #5b7cfa);
      outline-offset: 1px;
    }
  }
}

.message-bubble__reply-icon {
  flex-shrink: 0;
  color: var(--accent, #5b7cfa);
  opacity: 0.7;
}

.message-bubble__reply-author {
  flex-shrink: 0;
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--accent-text);
}

.message-bubble__reply-content {
  font-size: 0.625rem;
  color: var(--text-faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
