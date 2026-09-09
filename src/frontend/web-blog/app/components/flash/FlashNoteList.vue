<!--
  @file FlashNoteList.vue
  @description 闪念笔记流：双列瀑布流布局，支持空状态与加载态
  @author TixXin
  @since 2026-04-11
-->

<template>
  <div class="flash-note-list">
    <CommonRequestFeedback
      v-if="loading || errorMessage"
      :pending="loading"
      :compact="notes.length > 0"
      :title="errorMessage || '正在加载闪念'"
      :description="notes.length ? '仍显示上次成功加载的闪念，未提交的内容已保留。' : undefined"
      @retry="$emit('retry')"
    />

    <div v-if="!loading && !errorMessage && notes.length === 0" class="flash-note-list__empty">
      <Icon name="lucide:zap-off" size="24" />
      <span>{{ emptyMessage || (readOnly ? '博主还没有公开闪念' : '还没有闪念，记下第一个想法吧') }}</span>
    </div>

    <div v-if="notes.length" class="flash-note-list__masonry">
      <FlashNoteCard
        v-for="note in notes"
        :key="note.id"
        :note="note"
        :cited="citedIds?.includes(note.id)"
        :highlighted="note.id === highlightedId"
        :read-only="readOnly"
        :busy="pendingIds?.includes(note.id)"
        :current-user-id="currentUserId"
        :guest-id="guestId"
        @remove="$emit('remove', $event)"
        @edit="$emit('edit', note)"
        @toggle-like="$emit('toggle-like', $event)"
        @set-pinned="$emit('set-pinned', $event)"
        @set-archived="$emit('set-archived', $event)"
        @add-comment="$emit('add-comment', $event)"
        @remove-comment="$emit('remove-comment', $event)"
        @tag-click="$emit('tag-click', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FlashNote, FlashCommentSubmission } from '~/features/flash/types'

defineProps<{
  notes: FlashNote[]
  loading?: boolean
  errorMessage?: string | null
  emptyMessage?: string
  pendingIds?: string[]
  citedIds?: string[]
  readOnly?: boolean
  currentUserId?: string | null
  /** 游客设备 id，透传给卡片用于评论删除权限 */
  guestId?: string | null
  /** AI 引用高亮的笔记 id */
  highlightedId?: string | null
}>()

defineEmits<{
  retry: []
  remove: [id: string]
  edit: [note: FlashNote]
  'toggle-like': [id: string]
  'set-pinned': [payload: { id: string; pinned: boolean }]
  'set-archived': [payload: { id: string; archived: boolean }]
  'add-comment': [payload: FlashCommentSubmission]
  'remove-comment': [payload: { noteId: string; commentId: string }]
  'tag-click': [tag: string]
}>()
</script>

<style lang="scss" scoped>
.flash-note-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* CSS columns 实现的双列瀑布流：高度自适应、卡片不被截断 */
.flash-note-list__masonry {
  column-count: 1;
  column-gap: 0.875rem;

  @media (min-width: $breakpoint-md) {
    column-count: 2;
  }

  > * {
    display: inline-flex;
    width: 100%;
    margin-bottom: 0.875rem;
    /* 关键：避免卡片在两列之间被截断 */
    break-inside: avoid;
  }
}

.flash-note-list__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  padding: 3rem 1rem;
  color: var(--text-soft);
  font-size: 0.875rem;
}
</style>
