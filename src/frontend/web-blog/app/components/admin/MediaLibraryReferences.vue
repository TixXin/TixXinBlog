<!--
  @file MediaLibraryReferences.vue
  @description 媒体库的引用面板：引用数量、条目与翻页、加载失败重试，Esc 或关闭按钮收起；
               加载、失败与翻页使用同一标题承接焦点，入口焦点的保存与归还由媒体库负责
-->
<template>
  <section
    class="media-library__references"
    :aria-labelledby="headingId"
    :aria-busy="referenceLoading"
    @keydown.esc.stop.prevent="closeReferences"
  >
    <h3 :id="headingId" ref="heading" tabindex="-1">
      {{ $t('admin-media.mediaLibrary.references.heading', { name: referenceName })
      }}<span v-if="references">{{
        $t('admin-media.mediaLibrary.references.count', { total: references.total })
      }}</span>
    </h3>
    <p>{{ $t('admin-media.mediaLibrary.references.hint') }}</p>
    <button type="button" @click="closeReferences">{{ $t('admin-media.mediaLibrary.references.close') }}</button>
    <p v-if="referenceLoading" role="status">{{ $t('admin-media.mediaLibrary.references.loading') }}</p>
    <p v-else-if="referenceError" role="alert">
      {{ referenceError }}
      <button type="button" :disabled="!ready || working" @click="refresh()">
        {{ $t('admin-media.mediaLibrary.references.retry') }}
      </button>
    </p>
    <template v-else-if="references">
      <p v-if="!references.total">{{ $t('admin-media.mediaLibrary.references.none') }}</p>
      <ul v-else class="media-library__reference-list">
        <li v-for="(item, index) in references.items" :key="index">
          <NuxtLink :to="item.url">{{ item.title }}</NuxtLink> · {{ referenceLabel(item) }}
        </li>
      </ul>
      <div v-if="references.total" class="media-library__reference-pagination">
        <button
          type="button"
          :disabled="!ready || working || references.page <= 1"
          @click="refresh(references.page - 1)"
        >
          {{ $t('admin-media.mediaLibrary.references.previous') }}
        </button>
        <span>{{ references.page }} / {{ Math.max(1, Math.ceil(references.total / references.pageSize)) }}</span>
        <button
          type="button"
          :disabled="!ready || working || references.page * references.pageSize >= references.total"
          @click="refresh(references.page + 1)"
        >
          {{ $t('admin-media.mediaLibrary.references.next') }}
        </button>
      </div>
    </template>
  </section>
</template>
<script setup lang="ts">
import { nextTick, ref, useId } from 'vue'
import type { useMediaLibrary } from '~/composables/useMediaLibrary'
import { useMediaReferenceLabel } from '~/features/media/useMediaReferenceLabel'
const props = defineProps<{ controller: ReturnType<typeof useMediaLibrary> }>()
const {
  references,
  referenceId,
  referenceName,
  referenceLoading,
  referenceError,
  ready,
  working,
  showReferences,
  closeReferences,
} = props.controller
const referenceLabel = useMediaReferenceLabel()
const heading = ref<HTMLElement | null>(null)
const headingId = `media-references-${useId()}`
const focus = () => heading.value?.focus()
function refresh(targetPage = 1) {
  void showReferences(referenceId.value, targetPage)
  void nextTick(focus)
}
defineExpose({ focus })
</script>
<style scoped lang="scss">
@use '~/assets/styles/media-library' as media;
@include media.base;
@include media.reference-list;
.media-library__references {
  @include media.panel;
}
.media-library__reference-pagination {
  @include media.row;
}
.media-library__references h3:focus {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
@media (max-width: 500px) {
  .media-library__reference-pagination > button {
    flex: 1 1 8rem;
  }
}
</style>
