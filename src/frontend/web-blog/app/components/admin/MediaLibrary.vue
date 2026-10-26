<!--
  @file MediaLibrary.vue
  @description 媒体库与选择器共用：上传进度、检索、资料编辑、引用查看和批量回收恢复。
               各区块拆为 AdminMediaLibrary* 子组件，这里负责组装、列表网格、分页与引用面板的焦点往返。
-->
<template>
  <section class="media-library">
    <AdminMediaLibraryUpload :controller="controller" />
    <AdminMediaLibraryFilters :selectable="selectable" :controller="controller" />
    <p v-if="error" role="alert">
      {{ error }}
      <button type="button" :disabled="pending || working" @click="load">
        {{ $t('admin-media.mediaLibrary.reload') }}
      </button>
    </p>
    <p v-if="pending" role="status">{{ $t('admin-media.mediaLibrary.loading') }}</p>
    <AdminMediaLibraryReferences v-if="referenceId" ref="referencePanel" :controller="controller" />
    <AdminMediaLibraryBatchBar :selectable="selectable" :controller="controller" />
    <AdminMediaLibraryResults v-if="batchResults.length" :controller="controller" @open-references="openReferences" />
    <p v-if="!pending && !error && !items.length">{{ $t('admin-media.mediaLibrary.empty') }}</p>
    <ul class="media-library__grid">
      <AdminMediaLibraryCard
        v-for="asset in items"
        :key="asset.id"
        :asset="asset"
        :selectable="selectable"
        :controller="controller"
        @open-references="openReferences"
        @use="select(asset)"
      />
    </ul>
    <div class="media-library__pagination">
      <button type="button" :disabled="!ready || pending || working || page <= 1" @click="changePage(page - 1)">
        {{ $t('admin-media.mediaLibrary.pagination.previous') }}</button
      ><span class="media-library__page-summary">{{
        $t('admin-media.mediaLibrary.pagination.summary', { page, pages: Math.max(1, Math.ceil(total / 20)), total })
      }}</span
      ><button
        type="button"
        :disabled="!ready || pending || working || page * 20 >= total"
        @click="changePage(page + 1)"
      >
        {{ $t('admin-media.mediaLibrary.pagination.next') }}
      </button>
    </div>
  </section>
</template>
<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { MediaAsset } from '~/features/media/types'
import type { useMediaLibrary } from '~/composables/useMediaLibrary'
const props = defineProps<{ selectable: boolean; controller: ReturnType<typeof useMediaLibrary> }>()
const emit = defineEmits<{ selected: [asset: MediaAsset] }>()
function select(asset: MediaAsset) {
  if (props.controller.canSelect(asset)) emit('selected', asset)
}
const {
  page,
  total,
  items,
  pending,
  ready,
  working,
  error,
  referenceId,
  batchResults,
  load,
  changePage,
  showReferences,
} = props.controller
const referencePanel = ref<{ focus: () => void } | null>(null)
let referenceTrigger: HTMLElement | null = null
function openReferences(id: string, event: Event) {
  referenceTrigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  void showReferences(id)
  void nextTick(() => referencePanel.value?.focus())
}
// 引用面板的加载、失败与翻页使用同一标题，关闭时把键盘焦点还给入口。
watch(referenceId, async (id, previousId) => {
  if (id && id !== previousId) {
    if (!referenceTrigger?.isConnected) {
      referenceTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    }
    await nextTick()
    referencePanel.value?.focus()
  } else if (!id && previousId) {
    await nextTick()
    if (referenceTrigger?.isConnected) referenceTrigger.focus()
    referenceTrigger = null
  }
})
</script>
<style scoped lang="scss">
@use '~/assets/styles/media-library' as media;
@include media.base;
.media-library {
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
}
.media-library__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
  gap: 1rem;
}
.media-library__pagination {
  @include media.row;
}
@media (max-width: 500px) {
  .media-library__grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .media-library__pagination {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .media-library__page-summary {
    grid-column: 1 / -1;
    grid-row: 1;
    text-align: center;
  }
}
</style>
