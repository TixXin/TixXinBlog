<!--
  @file MomentFilterSummary.vue
  @description 朋友圈列表当前生效的筛选条件摘要条及清除按钮
  @author TixXin
  @since 2026-04-20
-->

<template>
  <div v-if="visible" class="moments-filter-summary">
    <span role="status" class="moments-filter-summary__label">{{
      $t('flash-moment.moments.filterCurrent', { summary: filterSummary })
    }}</span>
    <button type="button" class="filter-clear filter-clear--chip" @click="$emit('clear')">
      <Icon name="lucide:x" size="12" aria-hidden="true" />{{ $t('flash-moment.moments.clearFilters') }}
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
  filterSummary: string
}>()

defineEmits<{
  clear: []
}>()
</script>

<style lang="scss" scoped>
.moments-filter-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.75rem 1rem 0;
  font-size: 0.8125rem;
  color: var(--text-soft);

  @media (min-width: $breakpoint-md) {
    padding: 1rem 2rem 0;
  }
}

.moments-filter-summary__label {
  min-width: 0;
  overflow-wrap: anywhere;
}

.filter-clear {
  min-height: 44px;
  padding: 0.5rem;
  color: var(--accent-text);
}

.filter-clear--chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 32px;
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--border-soft);
  border-radius: $radius-full;
  background: var(--surface-2);
  font-size: 0.75rem;
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-colors;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    border-color: var(--accent);
    background: var(--accent-soft);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }
}
</style>
