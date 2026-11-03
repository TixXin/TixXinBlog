<!--
  @file CollectionPagination.vue
  @description 后台集合列表分页：每页 12 条，超过一页或不在首页时显示，只发出目标页码
-->
<template>
  <AdminModerationPagination
    v-if="total > PAGE_SIZE || page > 1"
    class="admin-collection-pagination"
    :page="page"
    :total="total"
    :page-size="PAGE_SIZE"
    :disabled="disabled"
    :aria-label="label"
    :prev-label="prevLabel"
    :next-label="nextLabel"
    :summary="summary"
    @prev="emit('go', page - 1)"
    @next="emit('go', page + 1)"
  />
</template>

<script setup lang="ts">
// 与 useAdminGallery / useAdminProjects / useAdminLinks 请求的 pageSize 一致
const PAGE_SIZE = 12

defineProps<{
  page: number
  total: number
  disabled: boolean
  label: string
  prevLabel: string
  nextLabel: string
  summary: string
}>()
const emit = defineEmits<{ go: [page: number] }>()
</script>

<style scoped lang="scss">
.admin-collection-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
</style>
