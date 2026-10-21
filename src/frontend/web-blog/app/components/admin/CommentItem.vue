<!--
  @file CommentItem.vue
  @description 文章评论单条卡片组件：展示评论作者、文章来源、审核状态、可见性与审核操作按钮
  @author TixXin
  @since 2026-10-21
-->
<template>
  <AdminModerationItem
    :selected="selected"
    selectable
    :select-disabled="pending || working"
    :select-aria-label="
      t('admin-content.comments.item.select', { author: comment.author, excerpt: comment.content.slice(0, 40) })
    "
    select-class="admin-comments__select"
    actions-class="admin-comments__actions"
    @toggle-select="$emit('toggle-select', $event)"
  >
    <template #header>
      <NuxtLink
        :to="comment.postStatus === 'published' ? `/articles/${comment.postId}` : `/admin/posts/${comment.postId}`"
        >{{ comment.postTitle }}</NuxtLink
      >
    </template>
    <template #meta>
      <p>
        <strong>{{ comment.author }}</strong>
        {{ comment.isOwner ? `· ${t('admin-content.comments.owner')}` : '' }} ·
        {{ comment.createdAt.slice(0, 10) }}
      </p>
    </template>
    <template #content>
      <p>{{ comment.content }}</p>
    </template>
    <template #extra>
      <p>
        {{ statusLabels[comment.status] }} ·
        {{ comment.visible ? t('admin-content.comments.item.visible') : t('admin-content.comments.item.invisible') }}
      </p>
      <p v-if="comment.postStatus !== 'published'">{{ t('admin-content.comments.item.postUnpublished') }}</p>
    </template>
    <template #actions>
      <button type="button" :disabled="working" @click="$emit('view-context', comment.id)">
        {{ t('admin-content.comments.item.viewContext') }}
      </button>
      <button
        v-if="comment.depth < 2 && comment.visible"
        type="button"
        :disabled="working"
        @click="$emit('reply', comment)"
      >
        {{ t('admin-content.comments.item.reply') }}
      </button>
      <button
        type="button"
        class="admin-btn admin-btn--sm admin-btn--danger"
        :disabled="pending || working"
        @click="$emit('remove', comment)"
      >
        {{ t('admin-content.comments.item.remove') }}
      </button>
      <button
        v-if="comment.status !== 'published'"
        type="button"
        :disabled="pending || working"
        @click="$emit('moderate', comment, 'published')"
      >
        {{ t('admin-content.comments.item.publish') }}
      </button>
      <button
        v-if="comment.status === 'published'"
        type="button"
        :disabled="pending || working"
        @click="$emit('moderate', comment, 'hidden')"
      >
        {{ t('admin-content.comments.item.hide') }}
      </button>
      <button
        v-if="comment.status !== 'spam'"
        type="button"
        :disabled="pending || working"
        @click="$emit('moderate', comment, 'spam')"
      >
        {{ t('admin-content.comments.item.spam') }}
      </button>
    </template>
  </AdminModerationItem>
</template>

<script setup lang="ts">
import type { AdminCommentRow, CommentStatus } from '~/features/article/types'

defineProps<{
  comment: AdminCommentRow
  selected?: boolean
  statusLabels: Record<CommentStatus, string>
  pending?: boolean
  working?: boolean
}>()

defineEmits<{
  'toggle-select': [checked: boolean]
  'view-context': [id: number]
  reply: [comment: AdminCommentRow]
  remove: [comment: AdminCommentRow]
  moderate: [comment: AdminCommentRow, status: CommentStatus]
}>()

const { t } = useI18n()
</script>

<style scoped>
li {
  min-width: 0;
  padding: 1rem 1.125rem 1rem 3rem;
  border: 1px solid var(--admin-card-border);
  border-radius: var(--admin-radius-card);
  background: var(--admin-card-bg);
  box-shadow: var(--admin-card-shadow);
  overflow-wrap: anywhere;
  position: relative;
  transition: border-color 0.15s ease;
}
li.is-selected {
  border-color: var(--accent-action);
  box-shadow:
    0 0 0 1px var(--accent-action),
    var(--admin-card-shadow);
}
li p {
  margin: 0.25rem 0;
  color: var(--text-muted);
  font-size: 0.875rem;
}
:deep(.admin-comments__select) {
  position: absolute;
  top: 0.75rem;
  left: 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
}
:deep(.admin-comments__select input) {
  margin: 0;
}
li > a {
  color: var(--text-soft);
  font-size: 0.75rem;
  text-decoration: none;
}
li > a:hover {
  color: var(--accent-text);
}
:deep(.admin-comments__actions) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.625rem;
}
@media (prefers-reduced-motion: reduce) {
  li {
    transition: none;
  }
}
</style>
