<!--
  @file MediaLibraryResults.vue
  @description 媒体库的批量回收结果：逐项状态与说明，仍被引用的资源列出部分引用并可打开完整引用面板
-->
<template>
  <section class="media-library__results" :aria-label="$t('admin-media.mediaLibrary.batch.resultsTitle')">
    <h3>{{ $t('admin-media.mediaLibrary.batch.resultsTitle') }}</h3>
    <ul>
      <li v-for="result in batchResults" :key="result.id">
        <p>
          <strong>{{ result.name }}</strong> · {{ $t(mediaRemovalStatusKeys[result.status]) }}
        </p>
        <p>{{ result.message }}</p>
        <template v-if="result.status === 'referenced'">
          <ul v-if="result.references?.items.length" class="media-library__reference-list">
            <li v-for="(item, index) in result.references.items" :key="index">
              <NuxtLink :to="item.url">{{ item.title }}</NuxtLink> · {{ referenceLabel(item) }}
            </li>
          </ul>
          <button type="button" :disabled="!ready || working" @click="emit('openReferences', result.id, $event)">
            {{ $t('admin-media.mediaLibrary.references.viewAll')
            }}<span v-if="result.references">{{
              $t('admin-media.mediaLibrary.references.count', { total: result.references.total })
            }}</span>
          </button>
        </template>
      </li>
    </ul>
  </section>
</template>
<script setup lang="ts">
import type { useMediaLibrary } from '~/composables/useMediaLibrary'
import { mediaRemovalStatusKeys } from '~/features/media/library'
import { useMediaReferenceLabel } from '~/features/media/useMediaReferenceLabel'
const props = defineProps<{ controller: ReturnType<typeof useMediaLibrary> }>()
const emit = defineEmits<{ openReferences: [id: string, event: Event] }>()
const { batchResults, ready, working } = props.controller
const referenceLabel = useMediaReferenceLabel()
</script>
<style scoped lang="scss">
@use '~/assets/styles/media-library' as media;
@include media.base;
@include media.reference-list;
.media-library__results {
  @include media.panel;
}
.media-library__results > ul > li + li {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}
</style>
