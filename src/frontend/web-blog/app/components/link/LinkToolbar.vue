<!--
  @file LinkToolbar.vue
  @description 友链列表工具栏：全部/推荐/其他分段筛选、结果计数与清除筛选同一行；筛选写回 URL 由页面处理
  @author TixXin
  @since 2026-11-06
-->
<template>
  <div class="link-toolbar">
    <div class="link-toolbar__filter" role="group" :aria-label="$t('interaction.links.featuredFilterLabel')">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="link-toolbar__option"
        :class="{ 'link-toolbar__option--active': (featured ?? '') === option.value }"
        :aria-pressed="(featured ?? '') === option.value"
        :disabled="!ready"
        @click="$emit('change', { featured: option.value || undefined })"
      >
        {{ $t(option.label) }}
      </button>
    </div>
    <p v-if="stale" role="status" class="link-toolbar__result">{{ $t('interaction.links.stale') }}</p>
    <p v-else-if="total !== null" role="status" class="link-toolbar__result">
      {{ $t('interaction.links.summary', { total, page }, total) }}
    </p>
    <button
      v-if="filtered"
      type="button"
      class="link-toolbar__clear"
      :disabled="!ready"
      @click="$emit('change', { q: undefined, featured: undefined })"
    >
      <Icon name="lucide:x" size="14" aria-hidden="true" />
      {{ $t('interaction.links.clearFilters') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { LinkQuery } from '~/features/link/types'

defineProps<{
  featured?: LinkQuery['featured']
  page: number
  total: number | null
  stale: boolean
  ready: boolean
  filtered: boolean
}>()
defineEmits<{ change: [patch: Partial<LinkQuery>] }>()

const options = [
  { value: '', label: 'interaction.links.filterAll' },
  { value: 'true', label: 'interaction.links.filterFeatured' },
  { value: 'false', label: 'interaction.links.filterOthers' },
] as const
</script>

<style scoped lang="scss">
.link-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.link-toolbar__filter {
  display: inline-flex;
  gap: 0.25rem;
  padding: 0.25rem;
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  border-radius: $radius-md;
}
.link-toolbar__option {
  min-height: 36px;
  padding: 0 0.875rem;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: var(--interaction-cursor, pointer);
  &:not(:disabled):hover {
    color: var(--text-main);
  }
  &--active {
    background: var(--surface-1);
    color: var(--text-main);
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  }
}
.link-toolbar__result {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-soft);
  font-variant-numeric: tabular-nums;
}
.link-toolbar__clear {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 36px;
  margin-left: auto;
  padding: 0 0.75rem;
  border: 1px solid var(--border);
  border-radius: $radius-sm;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.8125rem;
  cursor: var(--interaction-cursor, pointer);
  &:not(:disabled):hover {
    border-color: var(--accent);
    color: var(--accent-text);
  }
}
.link-toolbar__option,
.link-toolbar__clear {
  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  &:disabled {
    opacity: 0.5;
    cursor: var(--interaction-cursor, not-allowed);
  }
}
</style>
