<!--
  @file PostListBatchBar.vue
  @description 文章管理列表的批量栏：整页勾选、已选数量、清空或取消全选、全选筛选结果、批量动作与预览入口，
               以及选择上限说明；只发出事件，选择状态由页面维护
-->
<template>
  <div class="admin-toolbar admin-posts__batch" role="group" :aria-label="$t('admin-content.postList.batchGroup')">
    <label
      ><input
        ref="pageToggle"
        type="checkbox"
        :checked="allSelected"
        :disabled="disabled || !hasItems"
        @change="emit('togglePage', $event)"
      />{{ $t('admin-content.postList.selectPage') }}</label
    >
    <span role="status" aria-live="polite" aria-atomic="true">{{
      $t('admin-content.postList.selectedCount', { count: selectedCount })
    }}</span>
    <button type="button" :disabled="batchPending || (!selectedCount && !selectingAll)" @click="emit('clear')">
      {{ selectingAll ? $t('admin-content.postList.cancelSelectAll') : $t('admin-content.postList.clearSelection') }}
    </button>
    <CommonTooltip :content="$t('admin-content.postList.selectAllHint', { limit: POST_SELECTION_LIMIT })">
      <button
        type="button"
        :aria-busy="selectingAll"
        :disabled="disabled || !total || total > POST_SELECTION_LIMIT"
        aria-describedby="post-selection-help"
        @click="emit('selectAll')"
      >
        {{ selectingAll ? $t('admin-content.postList.selectingAll') : $t('admin-content.postList.selectAll') }}
      </button>
    </CommonTooltip>
    <select v-model="action" :aria-label="$t('admin-content.postList.batchAction')" :disabled="disabled">
      <option v-for="value in postBatchActions" :key="value" :value="value">
        {{ $t(postBatchLabelKey(value)) }}
      </option>
    </select>
    <button type="button" :disabled="disabled || !selectedCount" @click="emit('review')">
      {{ $t('admin-content.postList.reviewBatch') }}
    </button>
  </div>
  <p id="post-selection-help" class="admin-posts__help">
    {{ $t('admin-content.postList.selectionHelp', { selection: POST_SELECTION_LIMIT, batch: POST_BATCH_LIMIT })
    }}{{ total > POST_SELECTION_LIMIT ? $t('admin-content.postList.selectionOverLimit') : '' }}
  </p>
</template>
<script setup lang="ts">
import { POST_BATCH_LIMIT, POST_SELECTION_LIMIT, postBatchActions, postBatchLabelKey } from '~/features/post/batchTypes'
import type { PostBatchAction } from '~/features/post/batchTypes'

const props = defineProps<{
  allSelected: boolean
  partiallySelected: boolean
  selectedCount: number
  selectingAll: boolean
  /** 选择相关操作是否禁用（读取、提交、全选进行中或列表读取失败） */
  disabled: boolean
  hasItems: boolean
  total: number
  batchPending: boolean
}>()
const emit = defineEmits<{ togglePage: [event: Event]; clear: []; selectAll: []; review: [] }>()
const action = defineModel<PostBatchAction>('action', { required: true })
const pageToggle = ref<HTMLInputElement | null>(null)
// indeterminate 只能写 DOM 属性，辅助技术才会读到“部分选中”。
watchEffect(() => {
  if (pageToggle.value) pageToggle.value.indeterminate = props.partiallySelected
})
</script>
<style scoped lang="scss">
.admin-posts__batch {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-soft);
  border-radius: 0.5rem;
  background: var(--surface-2);
  color: var(--text-muted);
  font-size: 0.875rem;

  label {
    display: inline-flex;
    align-items: center;
    font-weight: 500;
  }
}
.admin-posts__help {
  margin: -0.25rem 0 0;
  padding: 0 0.25rem;
  color: var(--text-soft);
  font-size: 0.75rem;
}
@media (max-width: 700px) {
  .admin-posts__batch select,
  .admin-posts__batch button {
    width: 100%;
  }
}
</style>
