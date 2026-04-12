<!--
  @file FlashNoteList.vue
  @description 闪念笔记流：双列瀑布流布局，支持空状态与加载态
  @author TixXin
  @since 2026-04-11
-->

<template>
  <div class="flash-note-list">
    <div v-if="loading" class="flash-note-list__loading">
      <Icon name="lucide:loader-2" size="18" class="flash-note-list__spinner" />
      加载闪念中...
    </div>

    <div v-else-if="notes.length === 0" class="flash-note-list__empty">
      <Icon name="lucide:zap-off" size="24" />
      <span>还没有闪念，记下第一个想法吧</span>
    </div>

    <div v-else class="flash-note-list__masonry">
      <FlashNoteCard
        v-for="note in notes"
        :key="note.id"
        :note="note"
        :cited="citedIds?.includes(note.id)"
        :read-only="readOnly"
        :current-user-id="currentUserId"
        @remove="$emit('remove', $event)"
        @toggle-like="$emit('toggle-like', $event)"
        @add-comment="$emit('add-comment', $event)"
        @remove-comment="$emit('remove-comment', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FlashNote } from '~/features/flash/types'

defineProps<{
  notes: FlashNote[]
  loading?: boolean
  citedIds?: string[]
  readOnly?: boolean
  currentUserId?: string | null
}>()

defineEmits<{
  remove: [id: string]
  'toggle-like': [id: string]
  'add-comment': [payload: { noteId: string; content: string }]
  'remove-comment': [payload: { noteId: string; commentId: string }]
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

.flash-note-list__loading,
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

.flash-note-list__spinner {
  animation: flash-spin 1s linear infinite;
}

@keyframes flash-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
