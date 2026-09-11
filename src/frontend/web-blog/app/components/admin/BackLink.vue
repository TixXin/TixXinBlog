<!-- @file BackLink.vue @description 返回模块列表时保留当前标签页的筛选及分页 -->
<template>
  <NuxtLink :to="lists[to] || to"><slot /></NuxtLink>
</template>
<script setup lang="ts">
defineProps<{ to: string }>()
const lists = useState<Record<string, string>>('admin-list-return-paths', () => ({}))
</script>
