<!--
  @file PostListFilters.vue
  @description 文章管理列表的筛选栏：搜索、状态、分类、目录、标签与排序；
               只回写表单值并发出提交、排序与清空事件，跳转由页面负责
-->
<template>
  <form class="admin-card admin-toolbar admin-posts__filters" @submit.prevent="emit('apply')">
    <input
      v-model="search"
      class="admin-posts__search"
      :placeholder="$t('admin-content.postList.searchPlaceholder')"
      :aria-label="$t('admin-content.postList.searchPlaceholder')"
    />
    <select v-model="status" :aria-label="$t('admin-content.postList.statusFilter')" @change="emit('apply')">
      <option value="">{{ $t('admin-content.postList.allStatuses') }}</option>
      <option value="draft">{{ $t('admin-content.postStatus.draft') }}</option>
      <option value="published">{{ $t('admin-content.postStatus.published') }}</option>
      <option value="archived">{{ $t('admin-content.postStatus.archived') }}</option>
      <option value="trash">{{ $t('admin-content.postStatus.trash') }}</option>
    </select>
    <select v-model="category" :aria-label="$t('admin-content.postList.categoryFilter')" @change="emit('apply')">
      <option value="">{{ $t('admin-content.postList.allCategories') }}</option>
      <option value="tech">{{ $t('admin-content.postCategory.tech') }}</option>
      <option value="life">{{ $t('admin-content.postCategory.life') }}</option>
    </select>
    <select v-model="folder" :aria-label="$t('admin-content.postList.folderFilter')" @change="emit('apply')">
      <option value="">{{ $t('admin-content.postList.allFolders') }}</option>
      <option v-for="value in folders" :key="value" :value="value">{{ value }}</option>
    </select>
    <select v-model="tag" :aria-label="$t('admin-content.postList.tagFilter')" @change="emit('apply')">
      <option value="">{{ $t('admin-content.postList.allTags') }}</option>
      <option v-for="value in tags" :key="value" :value="value">{{ value }}</option>
    </select>
    <select v-model="sort" :aria-label="$t('admin-content.postList.sortField')" @change="emitOrdering('sort', $event)">
      <option value="updatedAt">{{ $t('admin-content.postList.sortUpdatedAt') }}</option>
      <option value="publishedAt">{{ $t('admin-content.postList.sortPublishedAt') }}</option>
      <option value="title">{{ $t('admin-content.postList.sortTitle') }}</option>
    </select>
    <select
      v-model="order"
      :aria-label="$t('admin-content.postList.sortOrder')"
      @change="emitOrdering('order', $event)"
    >
      <option value="desc">{{ $t('admin-content.postList.desc') }}</option>
      <option value="asc">{{ $t('admin-content.postList.asc') }}</option>
    </select>
    <button :aria-busy="pending" type="submit" :disabled="pending">
      {{ $t('admin-content.postList.search') }}
    </button>
    <button type="button" class="admin-btn admin-btn--ghost" :disabled="pending" @click="emit('clear')">
      {{ $t('admin-content.postList.clearFilters') }}
    </button>
  </form>
</template>
<script setup lang="ts">
defineProps<{ folders: string[]; tags: string[]; pending: boolean }>()
const emit = defineEmits<{ apply: []; ordering: [kind: 'sort' | 'order', value: string]; clear: [] }>()
const search = defineModel<string>('search', { required: true })
const status = defineModel<string>('status', { required: true })
const category = defineModel<string>('category', { required: true })
const folder = defineModel<string>('folder', { required: true })
const tag = defineModel<string>('tag', { required: true })
const sort = defineModel<string>('sort', { required: true })
const order = defineModel<string>('order', { required: true })

function emitOrdering(kind: 'sort' | 'order', event: Event) {
  emit('ordering', kind, (event.target as HTMLSelectElement).value)
}
</script>
<style scoped lang="scss">
.admin-posts__filters {
  padding: 0.75rem;
}
.admin-posts__search {
  flex: 1 1 14rem;
}
@media (max-width: 700px) {
  .admin-posts__filters > * {
    width: 100%;
  }
}
</style>
