<!--
  @file PostListPagination.vue
  @description 文章列表分页：上一页 / 页码（首尾与当前页前后两页，其余折叠为省略号）/ 下一页、页码状态与跳页表单；
               只发出目标页码，越界与禁用校验由页面负责
-->
<template>
  <nav class="admin-posts__pagination" :aria-label="t('admin-content.postList.pagination')">
    <button type="button" :disabled="disabled || page <= 1" @click="emit('go', page - 1)">
      {{ t('admin-content.postList.prevPage') }}
    </button>
    <template v-for="(entry, index) in entries" :key="index">
      <span v-if="entry === 'ellipsis'" aria-hidden="true">…</span>
      <button
        v-else
        type="button"
        :aria-label="t('admin-content.postList.pageLabel', { page: entry })"
        :aria-current="entry === page ? 'page' : undefined"
        :disabled="disabled"
        @click="emit('go', entry)"
      >
        {{ entry }}
      </button>
    </template>
    <button type="button" :disabled="disabled || page >= totalPages" @click="emit('go', page + 1)">
      {{ t('admin-content.postList.nextPage') }}
    </button>
    <span role="status" aria-live="polite">{{
      t('admin-content.postList.pageStatus', { page, totalPages, total })
    }}</span>
    <form class="admin-posts__jump" @submit.prevent="emit('go', Number(jumpPage))">
      <label for="admin-posts-page">{{ t('admin-content.postList.jumpLabel') }}</label>
      <input
        id="admin-posts-page"
        v-model="jumpPage"
        type="number"
        inputmode="numeric"
        min="1"
        :max="totalPages"
        step="1"
        required
        :disabled="disabled"
      />
      <button type="submit" :disabled="disabled">{{ t('admin-content.postList.jump') }}</button>
    </form>
  </nav>
</template>

<script setup lang="ts">
const props = defineProps<{ page: number; totalPages: number; total: number; disabled: boolean }>()
const emit = defineEmits<{ go: [page: number] }>()
const { t } = useI18n()

// 跳页输入跟随当前页，翻页后显示新页码
const jumpPage = ref<number | string>(props.page)
watch(
  () => props.page,
  (value) => (jumpPage.value = value),
)
const entries = computed(() => {
  const pages = new Set([1, props.totalPages])
  for (let value = Math.max(1, props.page - 2); value <= Math.min(props.totalPages, props.page + 2); value++)
    pages.add(value)
  const result: (number | 'ellipsis')[] = []
  for (const value of [...pages].sort((a, b) => a - b)) {
    const previous = result.at(-1)
    if (typeof previous === 'number' && value - previous > 1) result.push('ellipsis')
    result.push(value)
  }
  return result
})
</script>

<style scoped lang="scss">
.admin-posts__pagination,
.admin-posts__jump {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
}
.admin-posts__pagination {
  justify-content: center;
  color: var(--text-muted);
  font-size: 0.875rem;

  button[aria-current='page'] {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent-text);
    font-weight: 600;
  }
}
.admin-posts__jump input {
  width: 5rem;
}
</style>
