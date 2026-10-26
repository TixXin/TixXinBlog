<!--
  @file MediaLibraryFilters.vue
  @description 媒体库的检索栏：关键词、可用或已回收、方向与引用状态，以及引用筛选说明
-->
<template>
  <form class="media-library__filters" @submit.prevent="searchMedia">
    <input
      v-model="search"
      class="media-library__search"
      :disabled="!ready || working"
      :placeholder="$t('admin-media.mediaLibrary.searchPlaceholder')"
      :aria-label="$t('admin-media.mediaLibrary.searchLabel')"
      maxlength="128"
    /><select
      v-if="!selectable"
      v-model="deleted"
      :disabled="!ready || working"
      :aria-label="$t('admin-media.mediaLibrary.stateLabel')"
      @change="searchMedia"
    >
      <option value="false">{{ $t('admin-media.mediaLibrary.stateAvailable') }}</option>
      <option value="true">{{ $t('admin-media.mediaLibrary.stateDeleted') }}</option></select
    ><select
      v-model="orientation"
      :disabled="!ready || working || hasDirtyMetadata"
      :aria-label="$t('admin-media.mediaLibrary.orientationLabel')"
      @change="searchMedia"
    >
      <option value="">{{ $t('admin-media.mediaLibrary.orientationAll') }}</option>
      <option value="landscape">{{ $t('admin-media.mediaLibrary.orientationLandscape') }}</option>
      <option value="portrait">{{ $t('admin-media.mediaLibrary.orientationPortrait') }}</option>
      <option value="square">{{ $t('admin-media.mediaLibrary.orientationSquare') }}</option></select
    ><select
      v-model="usage"
      :disabled="!ready || working || hasDirtyMetadata"
      :aria-label="$t('admin-media.mediaLibrary.usageLabel')"
      @change="searchMedia"
    >
      <option value="">{{ $t('admin-media.mediaLibrary.usageAll') }}</option>
      <option value="used">{{ $t('admin-media.mediaLibrary.usageUsed') }}</option>
      <option value="unused">{{ $t('admin-media.mediaLibrary.usageUnused') }}</option></select
    ><button :aria-busy="pending" type="submit" :disabled="pending || !ready || working">
      {{ $t('admin-media.mediaLibrary.search') }}
    </button>
  </form>
  <p>{{ $t('admin-media.mediaLibrary.usageHint') }}</p>
</template>
<script setup lang="ts">
import type { useMediaLibrary } from '~/composables/useMediaLibrary'
const props = defineProps<{ selectable: boolean; controller: ReturnType<typeof useMediaLibrary> }>()
const { search, deleted, orientation, usage, hasDirtyMetadata, pending, ready, working, searchMedia } = props.controller
</script>
<style scoped lang="scss">
@use '~/assets/styles/media-library' as media;
@include media.base;
.media-library__filters {
  @include media.row;
}
.media-library__search {
  flex: 1 1 15rem;
}
@media (max-width: 500px) {
  // 窄屏筛选独占一行，避免原生控件按内容宽度挤出容器。
  .media-library__filters {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }
  .media-library__filters > * {
    width: 100%;
  }
}
</style>
