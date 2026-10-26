<!-- @file PageResultItem.vue @description 搜索结果条目：友链在新窗口打开，其余为站内链接；标题与摘要高亮关键词。 -->
<template>
  <li>
    <a v-if="item.type === 'link'" :href="item.url" target="_blank" rel="noopener noreferrer" data-search-result>
      <Icon :name="item.icon" aria-hidden="true" /><SearchHighlight :text="item.title" :keyword="keyword" /><Icon
        name="lucide:external-link"
        aria-hidden="true"
      />
      <span class="sr-only">{{ $t('article.search.newTab') }}</span>
    </a>
    <NuxtLink v-else :to="item.url" data-search-result
      ><Icon :name="item.icon" aria-hidden="true" /><SearchHighlight :text="item.title" :keyword="keyword"
    /></NuxtLink>
    <p><SearchHighlight :text="item.description" :keyword="keyword" /></p>
  </li>
</template>
<script setup lang="ts">
import SearchHighlight from '~/components/common/SearchHighlight.vue'
import type { SearchResultItem } from '~/features/search/types'

defineProps<{ item: SearchResultItem; keyword: string }>()
</script>
<style scoped lang="scss">
@use '~/assets/styles/search-page' as search;

[aria-current='page'] {
  @include search.current;
}
p {
  @include search.muted;
}
li {
  padding: 0.75rem 0;
  border-top: 1px solid var(--border);
}
li a {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  max-width: 100%;
}
li a:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
  border-radius: 0.25rem;
}
.search-highlight {
  min-width: 0;
}
a {
  @include search.link;
}
p {
  @include search.wrap;
}
</style>
