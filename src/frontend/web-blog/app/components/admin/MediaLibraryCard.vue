<!--
  @file MediaLibraryCard.vue
  @description 媒体库的资源卡片：批量勾选、预览或已回收占位、尺寸、替代文本与说明的编辑和保存，
               以及查看引用、回收或恢复、选择器模式下的“使用”入口
-->
<template>
  <li class="media-library__card">
    <label v-if="!selectable && deleted === 'false' && !asset.deleted" class="media-library__selection">
      <input
        type="checkbox"
        :checked="selectedIds.includes(asset.id)"
        :disabled="!canBatchSelect"
        :aria-label="$t('admin-media.mediaLibrary.asset.select', { name: asset.name })"
        @change="toggleSelection(asset)"
      />
      {{ $t('admin-media.mediaLibrary.asset.selectLabel') }}
    </label>
    <img v-if="!asset.deleted" :src="asset.url" :alt="asset.alt || asset.name" loading="lazy" />
    <div v-else class="media-library__removed">
      <Icon name="lucide:image-off" />{{ $t('admin-media.mediaLibrary.asset.removed') }}
    </div>
    <strong class="media-library__asset-name">{{ asset.name }}</strong>
    <p>
      {{
        $t('admin-media.mediaLibrary.asset.size', {
          width: asset.width,
          height: asset.height,
          size: Math.ceil(asset.byteSize / 1024),
        })
      }}
    </p>
    <label
      >{{ $t('admin-media.mediaLibrary.asset.alt')
      }}<input
        v-model="altDrafts[asset.id]"
        :aria-label="$t('admin-media.mediaLibrary.asset.altLabel', { name: asset.name })"
        maxlength="300"
        :disabled="!ready || asset.deleted || working"
    /></label>
    <label
      >{{ $t('admin-media.mediaLibrary.asset.description')
      }}<textarea
        v-model="descriptionDrafts[asset.id]"
        :aria-label="$t('admin-media.mediaLibrary.asset.descriptionLabel', { name: asset.name })"
        maxlength="1000"
        rows="3"
        :disabled="!ready || asset.deleted || working"
      />
    </label>
    <div class="media-library__actions">
      <button
        v-if="!asset.deleted"
        type="button"
        :disabled="!ready || working || altDrafts[asset.id] === asset.alt"
        @click="saveAlt(asset)"
      >
        {{ $t('admin-media.mediaLibrary.asset.saveAlt') }}
      </button>
      <button
        v-if="altDrafts[asset.id] !== asset.alt"
        type="button"
        :disabled="!ready || working"
        @click="altDrafts[asset.id] = asset.alt"
      >
        {{ $t('admin-media.mediaLibrary.asset.cancelAlt') }}
      </button>
      <button
        v-if="!asset.deleted"
        type="button"
        :disabled="!ready || working || descriptionDrafts[asset.id] === asset.description"
        @click="saveDescription(asset)"
      >
        {{ $t('admin-media.mediaLibrary.asset.saveDescription') }}
      </button>
      <button
        v-if="descriptionDrafts[asset.id] !== asset.description"
        type="button"
        :disabled="!ready || working"
        @click="descriptionDrafts[asset.id] = asset.description"
      >
        {{ $t('admin-media.mediaLibrary.asset.cancelDescription') }}
      </button>
      <button type="button" :disabled="!ready || working" @click="emit('openReferences', asset.id, $event)">
        {{ $t('admin-media.mediaLibrary.asset.references') }}
      </button>
      <button v-if="asset.deleted" type="button" :disabled="!ready || working" @click="restore(asset)">
        {{ $t('admin-media.mediaLibrary.asset.restore') }}
      </button>
      <button v-else type="button" :disabled="!ready || working || uploading" @click="remove(asset)">
        {{ $t('admin-media.mediaLibrary.asset.remove') }}
      </button>
      <button v-if="selectable && !asset.deleted" type="button" :disabled="!canSelect(asset)" @click="emit('use')">
        {{ $t('admin-media.mediaLibrary.asset.use') }}
      </button>
    </div>
  </li>
</template>
<script setup lang="ts">
import type { useMediaLibrary } from '~/composables/useMediaLibrary'
import type { MediaAsset } from '~/features/media/types'
const props = defineProps<{ asset: MediaAsset; selectable: boolean; controller: ReturnType<typeof useMediaLibrary> }>()
const emit = defineEmits<{ openReferences: [id: string, event: Event]; use: [] }>()
const {
  deleted,
  ready,
  working,
  uploading,
  altDrafts,
  descriptionDrafts,
  selectedIds,
  canBatchSelect,
  canSelect,
  toggleSelection,
  saveAlt,
  saveDescription,
  remove,
  restore,
} = props.controller
</script>
<style scoped lang="scss">
@use '~/assets/styles/media-library' as media;
@include media.base;
@include media.selection;
.media-library__card {
  @include media.panel;
}
textarea {
  width: 100%;
  resize: vertical;
}
.media-library__grid img,
.media-library__removed {
  width: 100%;
  height: 150px;
  object-fit: contain;
  margin-bottom: 0.75rem;
}
.media-library__removed {
  display: grid;
  place-content: center;
  color: var(--text-muted);
}
.media-library__actions {
  @include media.row;
}
.media-library__asset-name {
  display: block;
  min-width: 0;
  overflow-wrap: anywhere;
}
@media (max-width: 500px) {
  .media-library__actions > button {
    flex: 1 1 8rem;
  }
}
</style>
