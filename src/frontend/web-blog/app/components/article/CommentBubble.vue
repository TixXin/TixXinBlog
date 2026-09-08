<!--
  @file CommentBubble.vue
  @description 单条评论气泡组件，展示头像、作者、时间、内容和操作按钮
  @author TixXin
  @since 2026-04-03
-->

<template>
  <div class="comment-bubble" :data-comment-id="comment.id">
    <img
      :src="comment.avatar || '/avatar.svg'"
      :alt="comment.author"
      class="comment-bubble__avatar"
      :class="{ 'comment-bubble__avatar--sm': small }"
      loading="lazy"
      :width="small ? 32 : 36"
      :height="small ? 32 : 36"
    />
    <div class="comment-bubble__body">
      <div class="comment-bubble__meta">
        <span class="comment-bubble__author">{{ comment.author }}</span>
        <span v-if="comment.isOwner" class="comment-bubble__badge">作者</span>
        <span class="comment-bubble__time">{{ comment.time }}</span>
      </div>
      <p class="comment-bubble__content">{{ comment.content }}</p>
      <div class="comment-bubble__toolbar">
        <button
          type="button"
          class="comment-bubble__tool"
          :aria-pressed="!!comment.liked"
          :aria-label="`${comment.liked ? '取消点赞' : '点赞'} ${comment.author}的评论`"
          :disabled="busy"
          @click="$emit('like', comment.id)"
        >
          <Icon name="lucide:thumbs-up" size="14" />
          {{ pendingLikes.includes(comment.id) ? '处理中…' : comment.likes }}
        </button>
        <button
          v-if="depth < 2"
          type="button"
          class="comment-bubble__tool"
          :aria-label="`回复 ${comment.author}的评论`"
          :disabled="busy"
          @click="$emit('reply', comment)"
        >
          <Icon name="lucide:message-square" size="14" />
          回复
        </button>
      </div>
      <span v-if="depth >= 2" class="comment-bubble__time">已到最深回复层级</span>
      <ul v-if="comment.replies?.length" class="comment-bubble__replies">
        <li v-for="reply in comment.replies" :key="reply.id">
          <CommentBubble
            :comment="reply"
            small
            :depth="depth + 1"
            :busy="busy"
            :pending-likes="pendingLikes"
            @reply="$emit('reply', $event)"
            @like="$emit('like', $event)"
          />
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CommentItem } from '~/features/post/types'

withDefaults(
  defineProps<{
    comment: CommentItem
    small?: boolean
    depth?: number
    busy?: boolean
    pendingLikes?: number[]
  }>(),
  { depth: 0, pendingLikes: () => [] },
)
defineEmits<{ reply: [comment: CommentItem]; like: [id: number] }>()
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
  color: var(--accent-text);
}

.comment-bubble__time {
  font-size: 0.6875rem;
  color: var(--text-soft);
}

.comment-bubble__content {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.65;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
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
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--text-muted);
  }
}
.comment-bubble__tool[aria-pressed='true'] {
  color: var(--accent-text);
}
.comment-bubble__tool:disabled {
  opacity: 0.6;
  cursor: wait;
}
.comment-bubble__replies {
  list-style: none;
  margin: 1rem 0 0;
  padding: 0 0 0 0.5rem;
  border-left: 2px solid var(--border-soft);
  display: grid;
  gap: 1rem;
}
@media (max-width: 480px) {
  .comment-bubble {
    gap: 0.4rem;
  }
  .comment-bubble__replies {
    padding-left: 0;
  }
  .comment-bubble__avatar--sm {
    width: 1.5rem;
    height: 1.5rem;
  }
}
</style>
