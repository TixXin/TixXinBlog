<!--
  @file PostFilters.vue
  @description 文章标签与分类的共享展示，区分请求失败和真实空数据
-->
<template>
  <CommonRequestFeedback
    v-if="pending || error"
    class="card"
    compact
    :pending="pending"
    title="标签和分类暂时不可用"
    :description="available ? '仍显示上次成功加载的数据。' : undefined"
    @retry="$emit('retry')"
  />
  <template v-if="available">
    <SidebarTagCloudCard :tags="tags" :active-tag="activeTag" @select="$emit('select-tag', $event)" />
    <SidebarCategoryCard
      :categories="categories"
      :active-category="activeCategory"
      @select="$emit('select-category', $event)"
    />
  </template>
</template>

<script setup lang="ts">
import type { CategoryItem, TagItem } from '~/features/stats/types'

defineProps<{
  tags: TagItem[]
  categories: CategoryItem[]
  available: boolean
  pending: boolean
  error: boolean
  activeTag?: string | null
  activeCategory?: string | null
}>()
defineEmits<{ retry: []; 'select-tag': [value: string]; 'select-category': [value: string] }>()
</script>
