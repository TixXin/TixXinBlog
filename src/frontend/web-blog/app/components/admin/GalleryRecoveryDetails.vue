<!-- @file GalleryRecoveryDetails.vue @description 图库恢复副本完整只读字段，跨内容库不展示或绑定旧媒体文件 -->
<template>
  <dl class="recovery-details">
    <dt>{{ $t('admin-media.galleryForm.source') }}</dt>
    <dd>
      {{
        value.source === 'external'
          ? $t('admin-media.galleryForm.sourceExternal')
          : $t('admin-media.galleryForm.sourceMedia')
      }}
    </dd>
    <dt>{{ $t('admin-media.galleryForm.retainedExternalUrl') }}</dt>
    <dd>{{ value.externalUrl || $t('admin-media.galleryForm.notFilled') }}</dd>
    <dt>{{ $t('admin-media.galleryForm.title') }}</dt>
    <dd>{{ value.title || $t('admin-media.galleryForm.notFilled') }}</dd>
    <dt>{{ $t('admin-media.galleryForm.description') }}</dt>
    <dd>{{ value.description || $t('admin-media.galleryForm.notFilled') }}</dd>
    <dt>{{ $t('admin-media.galleryList.category') }}</dt>
    <dd>{{ value.category || $t('admin-media.galleryList.uncategorized') }}</dd>
    <dt>{{ $t('admin-media.galleryForm.takenOn') }}</dt>
    <dd>{{ value.takenOn || $t('admin-media.galleryForm.notFilled') }}</dd>
    <dt>{{ $t('admin-media.galleryForm.location') }}</dt>
    <dd>{{ value.location || $t('admin-media.galleryForm.notFilled') }}</dd>
    <dt>{{ $t('admin-media.galleryForm.device') }}</dt>
    <dd>{{ value.device || $t('admin-media.galleryForm.notFilled') }}</dd>
    <dt>{{ $t('admin-media.galleryForm.statusSort') }}</dt>
    <dd>{{ $t(`admin-media.galleryList.statusLabel.${value.status}`) }} / {{ value.sortOrder }}</dd>
    <dt>{{ $t('admin-media.galleryForm.relationIds') }}</dt>
    <dd>{{ contentRelationSummary(value.relatedContent, $t) }}</dd>
    <dt>{{ $t('admin-media.galleryForm.mediaId') }}</dt>
    <dd>
      {{ value.mediaId || $t('admin-media.galleryForm.noMedia') }}
      <p v-if="value.mediaId">{{ $t('admin-media.galleryForm.mediaRebind') }}</p>
    </dd>
  </dl>
</template>
<script setup lang="ts">
import type { GalleryEditable } from '~/features/gallery/types'
import { contentRelationSummary } from '~/features/content-relation/editor'
defineProps<{ value: GalleryEditable }>()
</script>
<style scoped>
.recovery-details {
  display: grid;
  gap: 0.35rem;
  overflow-wrap: anywhere;
}
dt {
  font-weight: 600;
  margin-top: 0.5rem;
}
dd {
  margin: 0;
  color: var(--text-muted);
  white-space: pre-wrap;
}
</style>
