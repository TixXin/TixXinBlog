<!-- @file RelatedContent.vue @description 博主维护的有序阅读入口，数据源只提供当前公开目标。 -->
<template>
  <section v-if="items?.length" class="related-content" aria-label="关联阅读">
    <h2>继续阅读与浏览</h2>
    <ul>
      <li v-for="item in items" :key="item.type + ':' + item.id">
        <NuxtLink :to="item.url"
          ><span>{{ contentRelationLabels[item.type] }}</span
          >{{ item.title }}</NuxtLink
        >
      </li>
    </ul>
  </section>
</template>
<script setup lang="ts">
import { contentRelationLabels } from '~/features/content-relation/types'
import type { RelatedContentItem } from '~/features/content-relation/types'
defineProps<{ items?: RelatedContentItem[] }>()
</script>
<style scoped lang="scss">
.related-content {
  margin: 1.25rem 0;
  min-width: 0;
}
h2 {
  font-size: 1.05rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}
ul {
  list-style: none;
  padding: 0;
  display: grid;
  gap: 0.6rem;
}
a {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  color: var(--accent);
  overflow-wrap: anywhere;
}
span {
  flex-shrink: 0;
  color: var(--text-muted);
  font-size: 0.8rem;
}
</style>
