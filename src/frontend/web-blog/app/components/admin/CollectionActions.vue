<!--
  @file CollectionActions.vue
  @description 后台集合卡片的操作组：编辑、查看公开页、上下架、排序升降与删除；只发出变更，提交与版本校验由组合函数负责
-->
<template>
  <div class="admin-collection-actions">
    <NuxtLink :to="editTo">{{ labels.edit }}</NuxtLink
    ><NuxtLink v-if="published && viewTo" :to="viewTo">{{ labels.view }}</NuxtLink
    ><button v-if="!published" type="button" :disabled="disabled" @click="emit('update', { status: 'published' })">
      {{ labels.publish }}</button
    ><button v-else type="button" :disabled="disabled" @click="emit('update', { status: 'withdrawn' })">
      {{ labels.withdraw }}</button
    ><slot /><button
      type="button"
      :disabled="disabled || sortOrder >= SORT_LIMIT"
      @click="emit('update', { sortOrder: sortOrder + 1 })"
    >
      {{ labels.raise }}</button
    ><button
      type="button"
      :disabled="disabled || sortOrder <= -SORT_LIMIT"
      @click="emit('update', { sortOrder: sortOrder - 1 })"
    >
      {{ labels.lower }}</button
    ><button class="admin-btn admin-btn--danger" type="button" :disabled="disabled" @click="emit('remove')">
      {{ labels.remove }}
    </button>
  </div>
</template>

<script setup lang="ts">
export interface CollectionActionLabels {
  edit: string
  view: string
  publish: string
  withdraw: string
  raise: string
  lower: string
  remove: string
}
export type CollectionActionPatch = { status: 'published' | 'withdrawn' } | { sortOrder: number }

// 与服务端排序值校验范围一致
const SORT_LIMIT = 1000000

defineProps<{
  editTo: string
  viewTo?: string
  published: boolean
  sortOrder: number
  disabled: boolean
  labels: CollectionActionLabels
}>()
const emit = defineEmits<{ update: [patch: CollectionActionPatch]; remove: [] }>()
</script>

<style scoped lang="scss">
.admin-collection-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
a {
  color: var(--accent);
}
</style>
