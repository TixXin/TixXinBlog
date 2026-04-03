<!--
  @file CommentBubble.vue
  @description 单条评论气泡组件，展示头像、作者、时间、内容和操作按钮
  @author TixXin
  @since 2026-04-03
-->

<template>
  <div class="comment-bubble">
    <img
      :src="comment.avatar"
      :alt="comment.author"
      class="comment-bubble__avatar"
      :class="{ 'comment-bubble__avatar--sm': small }"
      loading="lazy"
      :width="small ? 32 : 36"
      :height="small ? 32 : 36"
    >
    <div class="comment-bubble__body">
      <div class="comment-bubble__meta">
        <span class="comment-bubble__author">{{ comment.author }}</span>
        <span v-if="comment.isOwner" class="comment-bubble__badge">作者</span>
        <span class="comment-bubble__time">{{ comment.time }}</span>
      </div>
      <p class="comment-bubble__content">{{ comment.content }}</p>
      <div class="comment-bubble__toolbar">
        <button type="button" class="comment-bubble__tool">
          <Icon name="lucide:thumbs-up" size="14" />
          {{ comment.likes }}
        </button>
        <button type="button" class="comment-bubble__tool">
          <Icon name="lucide:message-square" size="14" />
          回复
        </button>
      </div>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CommentItem } from '~/features/post/types'

defineProps<{
  comment: CommentItem
  small?: boolean
}>()
</script>

<style lang="scss" scoped>
.comment-bubble {
  display: flex;
  gap: 0.75rem;
}

.comment-bubble__avatar {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: $radius-full;
  object-fit: cover;
  flex-shrink: 0;

  &--sm {
    width: 2rem;
    height: 2rem;
  }
}

.comment-bubble__body {
  flex: 1;
  min-width: 0;
}

.comment-bubble__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.comment-bubble__author {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-muted);
}

.comment-bubble__badge {
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0.125rem 0.375rem;
  border-radius: $radius-sm;
  background: var(--accent-soft);
  color: var(--accent);
}

.comment-bubble__time {
  font-size: 0.6875rem;
  color: var(--text-soft);
}

.comment-bubble__content {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.65;
  color: var(--text-muted);
}

.comment-bubble__toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 0.5rem;
}

.comment-bubble__tool {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0;
  border: none;
  background: none;
  font-size: 0.75rem;
  color: var(--text-soft);
  cursor: pointer;
  transition: $transition-fast;

  &:hover {
    color: var(--text-muted);
  }
}
</style>
