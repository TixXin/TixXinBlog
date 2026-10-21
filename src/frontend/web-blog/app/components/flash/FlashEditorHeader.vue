<!--
  @file FlashEditorHeader.vue
  @description 闪念编辑器顶部条：心情/类型切换与字数上限指示
  @author TixXin
  @since 2026-10-21
-->

<template>
  <header class="fed__header">
    <div class="fed__moods" role="group" :aria-label="$t('flash-moment.editor.typeGroup')">
      <button
        v-for="m in moods"
        :key="m.id"
        type="button"
        class="fed__mood"
        :class="{ 'fed__mood--active': mood === m.id }"
        :aria-pressed="mood === m.id"
        @click="$emit('update:mood', m.id)"
      >
        <Icon :name="m.icon" size="13" />
        {{ m.label }}
      </button>
    </div>
    <span class="fed__count" :class="{ 'fed__count--warn': count > maxLength * 0.9 }">
      {{ count }} / {{ maxLength }}
    </span>
  </header>
</template>

<script setup lang="ts">
import type { FlashType } from '~/features/flash/types'

defineProps<{
  mood: FlashType
  moods: { id: FlashType; icon: string; label: string }[]
  count: number
  maxLength: number
}>()

defineEmits<{
  'update:mood': [mood: FlashType]
}>()
</script>

<style lang="scss" scoped>
.fed__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.625rem 0.875rem 0.5rem;
}

.fed__moods {
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  background: var(--surface-2);
  border-radius: $radius-full;
  padding: 0.1875rem;
}

.fed__mood {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.625rem;
  border: none;
  border-radius: $radius-full;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--accent-text);
  }

  &--active {
    background: var(--surface-1);
    color: var(--accent-text);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }
}

.fed__count {
  font-size: 0.6875rem;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;

  &--warn {
    color: var(--danger);
  }
}
</style>
