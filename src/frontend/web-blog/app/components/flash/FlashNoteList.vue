<!--
  @file FlashNoteList.vue
  @description 闪念笔记流，支持空状态与加载态
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

    <TransitionGroup v-else name="flash-list" tag="div" class="flash-note-list__items">
      <FlashNoteCard
        v-for="note in notes"
        :key="note.id"
        :note="note"
        :cited="citedIds?.includes(note.id)"
        :read-only="readOnly"
        @remove="$emit('remove', $event)"
      />
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import type { FlashNote } from '~/features/flash/types'

defineProps<{
  notes: FlashNote[]
  loading?: boolean
  citedIds?: string[]
  readOnly?: boolean
}>()

defineEmits<{
  remove: [id: string]
}>()
</script>

<style lang="scss" scoped>
.flash-note-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.flash-note-list__items {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
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

/* TransitionGroup */
.flash-list-enter-active,
.flash-list-leave-active {
  transition: all 0.3s ease;
}

.flash-list-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.flash-list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.flash-list-leave-active {
  position: absolute;
  width: 100%;
}
</style>
