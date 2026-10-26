<!-- @file PageResultGroup.vue @description 搜索结果的单类型分组：标题与计数、预览时的查看全部、来源不可用与无结果状态及结果列表。 -->
<template>
  <section class="search-page__group" :data-search-type="group.type">
    <header>
      <h2>{{ searchTypeLabel(group.type, t) }}</h2>
      <span v-if="group.total !== null">{{ $t('article.search.itemCount', { count: group.total }, group.total) }}</span>
      <NuxtLink
        v-if="activeType === 'all' && group.total !== null && group.total > group.items.length"
        :to="searchLocation(keyword, group.type)"
        >{{ $t('article.search.viewAll', { type: searchTypeLabel(group.type, t) }) }}</NuxtLink
      >
    </header>
    <p v-if="group.unavailable" role="status">{{ $t('article.search.sourceUnavailable') }}</p>
    <p v-else-if="!group.items.length">{{ $t('article.search.noResults') }}</p>
    <ul v-else>
      <SearchPageResultItem v-for="item in group.items" :key="item.id" :item="item" :keyword="keyword" />
    </ul>
  </section>
</template>
<script setup lang="ts">
import { searchLocation } from '~/features/search/query'
import { searchTypeLabel } from '~/features/search/types'
import type { SearchGroup, SearchScope } from '~/features/search/types'

defineProps<{ group: SearchGroup; activeType: SearchScope; keyword: string }>()
const { t } = useI18n()
</script>
<style scoped lang="scss">
@use '~/assets/styles/search-page' as search;

.search-page__group header {
  @include search.bar;
}
[aria-current='page'] {
  @include search.current;
}
p,
header span {
  @include search.muted;
}
.search-page__group {
  margin: 1.5rem 0;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  min-width: 0;
}
h2 {
  font-size: 1.1rem;
  font-weight: 600;
}
ul {
  list-style: none;
  padding: 0;
}
a {
  @include search.link;
}
p {
  @include search.wrap;
}
</style>
