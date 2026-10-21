<!-- @file PromptPagination.vue @description 提示词列表底部统计与分页控制 -->
<template>
  <footer v-if="total !== null && !pageOutOfRange && (hasItems || page > 1)" class="prompts-bottom">
    <p>
      {{ $t(draftView ? 'misc.prompt.page.totalDrafts' : 'misc.prompt.page.totalPrompts', { count: total }, total)
      }}<span> / </span>{{ $t('misc.prompt.page.newestFirst') }}
    </p>
    <nav v-if="total > 12 || page > 1" :aria-label="$t('misc.prompt.page.paginationLabel')">
      <button
        type="button"
        :aria-label="$t('misc.prompt.page.previousPage')"
        :disabled="!ready || currentPending || page <= 1"
        @click="$emit('changePage', page - 1)"
      >
        <Icon name="lucide:arrow-left" size="16" /></button
      ><span>{{ page }} / {{ pageCount }}</span
      ><button
        type="button"
        :aria-label="$t('misc.prompt.page.nextPage')"
        :disabled="!ready || currentPending || page * 12 >= total"
        @click="$emit('changePage', page + 1)"
      >
        <Icon name="lucide:arrow-right" size="16" />
      </button>
    </nav>
  </footer>
</template>
<script setup lang="ts">
defineProps<{
  total: number | null
  pageOutOfRange: boolean
  hasItems: boolean
  page: number
  pageCount: number
  draftView: boolean
  ready: boolean
  currentPending: boolean
}>()

defineEmits<{
  changePage: [page: number]
}>()
</script>
<style scoped lang="scss">
.prompts-bottom {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: space-between;
  align-items: center;
  padding: 1.2rem 0 0.5rem;
  border-top: 1px solid var(--border);
}
.prompts-bottom p {
  font-size: 0.67rem;
  color: var(--text-soft);
}
.prompts-bottom p span {
  margin-inline: 0.5rem;
}
.prompts-bottom nav {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  font-size: 0.72rem;
  color: var(--text-soft);
}
.prompts-bottom nav button {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 50%;
  color: var(--text-main);
  transition:
    background-color 0.16s,
    border-color 0.16s,
    color 0.16s;
}
.prompts-bottom nav button:not(:disabled):hover {
  background: var(--accent-soft);
  color: var(--accent-text);
}
button:disabled {
  opacity: 0.45;
  cursor: default;
}
@media (prefers-reduced-motion: reduce) {
  .prompts-bottom nav button {
    transition: none;
  }
}
@media (max-width: 640px) {
  .prompts-bottom p {
    line-height: 1.8;
  }
}
</style>
