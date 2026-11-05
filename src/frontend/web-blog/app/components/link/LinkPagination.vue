<!--
  @file LinkPagination.vue
  @description 友链列表上一页/下一页分页，每页 12 条；页码写回 URL 由页面处理
  @author TixXin
  @since 2026-11-06
-->
<template>
  <nav class="links-pagination" :aria-label="$t('interaction.links.pagination')">
    <button type="button" :disabled="disabled || page <= 1" @click="$emit('change', page - 1)">
      {{ $t('interaction.links.prev') }}
    </button>
    <span>{{ page }} / {{ Math.max(1, Math.ceil(total / PAGE_SIZE)) }}</span>
    <button type="button" :disabled="disabled || page * PAGE_SIZE >= total" @click="$emit('change', page + 1)">
      {{ $t('interaction.links.next') }}
    </button>
  </nav>
</template>

<script setup lang="ts">
const PAGE_SIZE = 12
defineProps<{ page: number; total: number; disabled: boolean }>()
defineEmits<{ change: [page: number] }>()
</script>

<style scoped lang="scss">
.links-pagination {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  justify-content: center;
  margin-top: 1.25rem;
}
.links-pagination button {
  min-height: 44px;
  max-width: 100%;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--surface-2);
  color: var(--text-main);
  font-size: 0.8125rem;
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-colors;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  &:not(:disabled):hover {
    border-color: var(--accent);
    color: var(--accent-text);
  }
  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  &:disabled {
    opacity: 0.5;
    cursor: var(--interaction-cursor, not-allowed);
  }
}
.links-pagination span {
  min-width: 3.5rem;
  text-align: center;
  font-size: 0.8125rem;
  color: var(--text-soft);
  font-variant-numeric: tabular-nums;
}
</style>
