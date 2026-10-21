<!-- @file SearchModalGroup.vue @description 搜索弹窗单个领域分组的结果列表与外链处理 -->
<template>
  <section class="search-modal__group" :data-search-type="group.type">
    <h2>
      {{ typeLabel(group.type) }}
      <span v-if="group.total !== null">{{ $t('layout.searchModal.groupTotal', { count: group.total }) }}</span>
    </h2>
    <p v-if="group.unavailable" class="search-modal__status">{{ $t('layout.searchModal.unavailable') }}</p>
    <p v-else-if="!group.items.length" class="search-modal__status">
      {{ $t('layout.searchModal.noGroupResults') }}
    </p>
    <ul v-else class="search-modal__list">
      <li v-for="item in group.items" :key="`${item.type}:${item.id}`">
        <a
          :href="item.url"
          class="search-modal__item"
          :class="{ 'search-modal__item--active': selectedIndex === results.indexOf(item) }"
          :data-result-selected="selectedIndex === results.indexOf(item)"
          :data-result-index="results.indexOf(item)"
          @click="emit('clickResult', $event, item)"
          @mouseenter="emit('hoverResult', results.indexOf(item))"
          @focus="emit('hoverResult', results.indexOf(item))"
          @keydown="emit('keydown', $event)"
        >
          <Icon :name="item.icon" size="16" class="search-modal__item-icon" />
          <div class="search-modal__item-content">
            <span class="search-modal__item-title">
              <SearchHighlight :text="item.title" :keyword="query" />
            </span>
            <span class="search-modal__item-desc line-clamp-1">
              <SearchHighlight :text="item.description" :keyword="query" />
            </span>
          </div>
          <span class="search-modal__item-type">{{ typeLabel(item.type) }}</span>
        </a>
      </li>
    </ul>
    <button
      v-if="activeType === 'all' && group.total !== null && group.total > group.items.length"
      type="button"
      class="search-modal__more"
      @click="emit('selectType', group.type)"
    >
      {{ $t('layout.searchModal.viewAll', { type: typeLabel(group.type) }) }}
    </button>
  </section>
</template>

<script setup lang="ts">
import SearchHighlight from '~/components/common/SearchHighlight.vue'
import type { SearchGroup, SearchScope } from '~/features/search/types'
import { searchTypeLabel } from '~/features/search/types'
import type { SearchResultItem } from '~/composables/useSearch'

defineProps<{
  group: SearchGroup
  query: string
  activeType: SearchScope
  results: SearchResultItem[]
  selectedIndex: number
}>()

const emit = defineEmits<{
  (e: 'selectType', type: SearchScope): void
  (e: 'clickResult', event: MouseEvent, item: SearchResultItem): void
  (e: 'hoverResult', index: number): void
  (e: 'keydown', event: KeyboardEvent): void
}>()

const { t } = useI18n()

function typeLabel(type: string) {
  return searchTypeLabel(type, t)
}
</script>

<style lang="scss" scoped>
.search-modal__group h2 {
  padding: 0.65rem 1rem 0.2rem;
  font-size: 0.85rem;
  font-weight: 600;
}

.search-modal__status {
  padding: 0.5rem 1rem;
  color: var(--text-soft);
  font-size: 0.8125rem;
}

.search-modal__more {
  display: block;
  padding: 0.65rem 1rem;
  color: var(--accent);
  font-size: 0.8rem;
}

.search-modal__list {
  list-style: none;
  margin: 0;
  padding: 0.5rem;
}

.search-modal__item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: $radius-md;
  cursor: var(--interaction-cursor, pointer);
  text-decoration: none;
  transition: background 0.15s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &--active {
    background: var(--surface-2);
  }
}

.search-modal__item-icon {
  color: var(--text-soft);
  flex-shrink: 0;
}

.search-modal__item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.search-modal__item-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-main);
}

.search-modal__item-desc {
  font-size: 0.75rem;
  color: var(--text-soft);
}

.search-modal__item-type {
  font-size: 0.6875rem;
  color: var(--text-faint);
  background: var(--surface-3);
  padding: 0.125rem 0.5rem;
  border-radius: $radius-sm;
  flex-shrink: 0;
}
</style>
