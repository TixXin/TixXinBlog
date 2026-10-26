<!--
  @file MediaLibraryBatchBar.vue
  @description 媒体库的批量回收栏：全选、已选数量、清空与回收入口，常驻的不可用原因，处理进度与完成汇总
-->
<template>
  <div v-if="!selectable && deleted === 'false'" class="media-library__batch">
    <label class="media-library__selection">
      <CommonTooltip :content="$t('admin-media.mediaLibrary.batch.selectHint')">
        <input
          type="checkbox"
          :checked="allSelected"
          :indeterminate="someSelected"
          :disabled="!canBatchSelect || !items.length"
          @change="toggleAll"
        />
      </CommonTooltip>
      {{ $t('admin-media.mediaLibrary.batch.selectAll') }}
    </label>
    <span role="status">{{ $t('admin-media.mediaLibrary.batch.selected', { count: selectedIds.length }) }}</span>
    <button type="button" :disabled="!canBatchSelect || !selectedIds.length" @click="clearSelection">
      {{ $t('admin-media.mediaLibrary.batch.clear') }}
    </button>
    <CommonTooltip :content="$t('admin-media.mediaLibrary.batch.removeHint')">
      <button
        type="button"
        :disabled="!canBatchSelect || !selectedIds.length"
        :aria-describedby="batchHint ? batchHintId : undefined"
        @click="removeSelected"
      >
        <Icon name="lucide:trash-2" aria-hidden="true" />
        {{ $t('admin-media.mediaLibrary.batch.remove') }}
      </button>
    </CommonTooltip>
    <!-- 禁用原因常驻显示，读屏通过 aria-describedby 获知按钮不可用的原因 -->
    <p v-if="batchHint" :id="batchHintId" class="media-library__batch-hint">{{ batchHint }}</p>
  </div>
  <p v-if="batchProgress" role="status">
    {{
      $t('admin-media.mediaLibrary.batch.progress', {
        completed: batchProgress.completed,
        total: batchProgress.total,
      })
    }}
  </p>
  <!-- 完成后只播报一条汇总，逐项结果不整体实时播报，避免读屏重复朗读整块列表 -->
  <p v-if="batchSummary" role="status" class="media-library__batch-summary">{{ batchSummary }}</p>
</template>
<script setup lang="ts">
import { computed, useId } from 'vue'
import type { useMediaLibrary } from '~/composables/useMediaLibrary'
import type { MediaRemovalResult } from '~/features/media/types'
const props = defineProps<{ selectable: boolean; controller: ReturnType<typeof useMediaLibrary> }>()
const { t } = useI18n()
const {
  deleted,
  items,
  jobs,
  pending,
  ready,
  working,
  uploading,
  hasDirtyMetadata,
  selectedIds,
  allSelected,
  someSelected,
  canBatchSelect,
  batchResults,
  batchProgress,
  toggleAll,
  clearSelection,
  removeSelected,
} = props.controller
/** 批量回收完成后的汇总；处理中由进度状态播报 */
const batchSummary = computed(() => {
  if (batchProgress.value || !batchResults.value.length) return ''
  const count = (status: MediaRemovalResult['status']) =>
    batchResults.value.filter((result) => result.status === status).length
  return t('admin-media.mediaLibrary.batch.summary', {
    removed: count('removed'),
    referenced: count('referenced'),
    failed: count('failed'),
  })
})
const batchHintId = `media-batch-hint-${useId()}`
/** 批量回收不可用时的原因，按优先级给出可操作的说明 */
const batchHint = computed(() => {
  if (canBatchSelect.value) return selectedIds.value.length ? '' : t('admin-media.mediaLibrary.batch.hintNoSelection')
  if (!ready.value || pending.value) return t('admin-media.mediaLibrary.batch.hintLoading')
  if (working.value || uploading.value) return t('admin-media.mediaLibrary.batch.hintBusy')
  if (jobs.value.some((job) => !!job.file)) return t('admin-media.mediaLibrary.batch.hintPendingJobs')
  if (hasDirtyMetadata.value) return t('admin-media.mediaLibrary.batch.hintDirty')
  return t('admin-media.mediaLibrary.batch.hintOwnership')
})
</script>
<style scoped lang="scss">
@use '~/assets/styles/media-library' as media;
@include media.base;
@include media.selection;
.media-library__batch {
  @include media.row;
}
.media-library__batch-hint {
  flex-basis: 100%;
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-muted);
}
</style>
