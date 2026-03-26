<!--
  @file CommentSection.vue
  @description 文章评论区：输入框与评论列表（含嵌套回复）
  @author TixXin
  @since 2026-03-20
-->

<template>
  <section class="comment-section">
    <h2 class="comment-section__title">
      <Icon name="lucide:message-circle" size="20" />
      评论
      <span class="comment-section__count">({{ comments.length }})</span>
    </h2>

    <div class="comment-section__composer">
      <div class="comment-section__avatar comment-section__avatar--placeholder">
        <Icon name="lucide:user" size="16" />
      </div>
      <div class="comment-section__form">
        <textarea
          v-model="draft"
          class="comment-section__textarea"
          rows="3"
          placeholder="写下你的评论..."
        />
        <div class="comment-section__actions">
          <button type="button" class="comment-section__submit">发布评论</button>
        </div>
      </div>
    </div>

    <ul class="comment-section__list">
      <li v-for="item in comments" :key="item.id" class="comment-section__thread">
        <div class="comment-section__row">
          <img
            :src="item.avatar"
            :alt="item.author"
            class="comment-section__avatar-img"
            loading="lazy"
            width="36"
            height="36"
          >
          <div class="comment-section__body">
            <div class="comment-section__meta">
              <span class="comment-section__author">{{ item.author }}</span>
              <span v-if="item.isOwner" class="comment-section__badge">作者</span>
              <span class="comment-section__time">{{ item.time }}</span>
            </div>
            <p class="comment-section__content">{{ item.content }}</p>
            <div class="comment-section__toolbar">
              <button type="button" class="comment-section__tool">
                <Icon name="lucide:thumbs-up" size="14" />
                {{ item.likes }}
              </button>
              <button type="button" class="comment-section__tool">
                <Icon name="lucide:message-square" size="14" />
                回复
              </button>
            </div>
            <ul v-if="item.replies?.length" class="comment-section__replies">
              <li v-for="reply in item.replies" :key="reply.id" class="comment-section__reply">
                <img
                  :src="reply.avatar"
                  :alt="reply.author"
                  class="comment-section__avatar-img comment-section__avatar-img--sm"
                  loading="lazy"
                  width="32"
                  height="32"
                >
                <div class="comment-section__body">
                  <div class="comment-section__meta">
                    <span class="comment-section__author">{{ reply.author }}</span>
                    <span v-if="reply.isOwner" class="comment-section__badge">作者</span>
                    <span class="comment-section__time">{{ reply.time }}</span>
                  </div>
                  <p class="comment-section__content">{{ reply.content }}</p>
                  <div class="comment-section__toolbar">
                    <button type="button" class="comment-section__tool">
                      <Icon name="lucide:thumbs-up" size="14" />
                      {{ reply.likes }}
                    </button>
                    <button type="button" class="comment-section__tool">
                      <Icon name="lucide:message-square" size="14" />
                      回复
                    </button>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { CommentItem } from '~/features/post/types'

defineProps<{
  comments: CommentItem[]
}>()

const draft = ref('')
</script>

<style lang="scss" scoped>
.comment-section {
  padding: 1.5rem 0 2rem;
  border-top: 1px solid var(--border-soft);
}

.comment-section__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 1.5rem;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-main);
}

.comment-section__count {
  font-size: 0.875rem;
  font-weight: 400;
  color: var(--text-soft);
}

.comment-section__composer {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 2rem;
}

.comment-section__avatar {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: $radius-full;
  flex-shrink: 0;
  overflow: hidden;

  &--placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-3);
    color: var(--text-soft);
  }
}

.comment-section__form {
  flex: 1;
  min-width: 0;
}

.comment-section__textarea {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: $radius-md;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-main);
  font-family: $font-family-base;
  font-size: 0.875rem;
  line-height: 1.5;
  resize: none;
  outline: none;
  transition: $transition-fast;

  &::placeholder {
    color: var(--text-soft);
  }

  &:focus {
    border-color: var(--focus-ring);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
}

.comment-section__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.comment-section__submit {
  padding: 0.5rem 1.25rem;
  border: none;
  border-radius: $radius-md;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  background: var(--accent);
  color: var(--surface-1);
  transition: $transition-fast;

  &:hover {
    opacity: 0.92;
  }
}

.comment-section__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.comment-section__thread {
  margin: 0;
}

.comment-section__row {
  display: flex;
  gap: 0.75rem;
}

.comment-section__avatar-img {
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

.comment-section__body {
  flex: 1;
  min-width: 0;
}

.comment-section__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.comment-section__author {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-muted);
}

.comment-section__badge {
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0.125rem 0.375rem;
  border-radius: $radius-sm;
  background: var(--accent-soft);
  color: var(--accent);
}

.comment-section__time {
  font-size: 0.6875rem;
  color: var(--text-soft);
}

.comment-section__content {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.65;
  color: var(--text-muted);
}

.comment-section__toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 0.5rem;
}

.comment-section__tool {
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

.comment-section__replies {
  list-style: none;
  margin: 1rem 0 0;
  padding: 0 0 0 0.5rem;
  border-left: 2px solid var(--border-soft);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.comment-section__reply {
  display: flex;
  gap: 0.75rem;
}
</style>
