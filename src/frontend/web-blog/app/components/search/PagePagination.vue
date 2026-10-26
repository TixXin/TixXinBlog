<!-- @file PagePagination.vue @description 单类型搜索的服务端分页：上一页、页码状态与下一页。 -->
<template>
  <nav class="search-page__pagination" :aria-label="$t('article.search.paginationLabel')">
    <NuxtLink v-if="page > 1" :to="searchLocation(keyword, type, page - 1)">{{
      $t('article.pagination.previous')
    }}</NuxtLink>
    <span role="status">{{ $t('article.search.pageStatus', { page, total }, total) }}</span>
    <NuxtLink v-if="page * SEARCH_PAGE_SIZE < total" :to="searchLocation(keyword, type, page + 1)">{{
      $t('article.pagination.next')
    }}</NuxtLink>
  </nav>
</template>
<script setup lang="ts">
import { searchLocation } from '~/features/search/query'
import { SEARCH_PAGE_SIZE } from '~/features/search/types'
import type { SearchScope } from '~/features/search/types'

defineProps<{ keyword: string; type: SearchScope; page: number; total: number }>()
</script>
<style scoped lang="scss">
@use '~/assets/styles/search-page' as search;

.search-page__pagination {
  @include search.bar;
}
.search-page__pagination a {
  @include search.control;
}
.search-page__pagination a {
  @include search.control-link;
}
[aria-current='page'] {
  @include search.current;
}
a {
  @include search.link;
}
</style>
