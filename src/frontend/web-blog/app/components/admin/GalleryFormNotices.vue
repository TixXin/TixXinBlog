<!-- @file GalleryFormNotices.vue @description 图库编辑表单的恢复提示：本机恢复副本、另外保留的旧副本与服务器上的新版本 -->
<template>
  <section v-if="recovery" class="gallery-editor__notice" :aria-label="$t('admin-media.galleryForm.recoveryLabel')">
    <h2>{{ $t('admin-media.galleryForm.recoveryTitle') }}</h2>
    <AdminGalleryRecoveryDetails :value="recovery.form" />
    <button type="button" :disabled="saving || !ready" @click="emit('restore')">
      {{ $t('admin-media.galleryForm.restore') }}</button
    ><button type="button" :disabled="saving" @click="emit('discard')">
      {{ $t('admin-media.galleryForm.discard') }}
    </button>
  </section>
  <section
    v-if="previousRecoveries.length"
    class="gallery-editor__notice"
    :aria-label="$t('admin-media.galleryForm.previousLabel')"
  >
    <h2>{{ $t('admin-media.galleryForm.previousTitle') }}</h2>
    <p>{{ $t('admin-media.galleryForm.previousBody') }}</p>
    <article v-for="copy in previousRecoveries" :key="copy.key">
      <p>{{ $t('admin-media.galleryForm.savedAt', { time: copy.value.savedAt }) }}</p>
      <AdminGalleryRecoveryDetails :value="copy.value.form" />
    </article>
  </section>
  <section v-if="serverVersion" class="gallery-editor__notice" :aria-label="$t('admin-media.galleryForm.serverLabel')">
    <h2>{{ $t('admin-media.galleryForm.serverTitle', { revision: serverVersion.revision }) }}</h2>
    <p>
      {{ serverVersion.title }} · {{ $t(`admin-media.galleryList.statusLabel.${serverVersion.status}`) }} ·
      {{ $t('admin-media.galleryForm.sortValue', { sort: serverVersion.sortOrder }) }}
    </p>
    <p>{{ serverVersion.description }}</p>
    <p>
      {{
        $t('admin-media.galleryForm.relations', {
          relations: contentRelationSummary(serverVersion.relatedContent, $t),
        })
      }}
    </p>
    <p>
      {{ serverVersion.category || $t('admin-media.galleryList.uncategorized') }} ·
      {{ serverVersion.takenOn || $t('admin-media.galleryForm.noTakenOn') }} ·
      {{ serverVersion.location || $t('admin-media.galleryForm.noLocation') }} ·
      {{ serverVersion.device || $t('admin-media.galleryForm.noDevice') }}
    </p>
    <CommonImageFrame
      class="gallery-editor__preview"
      :src="serverVersion.src"
      :alt="serverVersion.title"
      :width="serverVersion.width"
      :height="serverVersion.height"
      fit="contain"
    /><button type="button" :disabled="saving" @click="emit('reload')">
      {{ $t('admin-media.galleryForm.loadServer') }}</button
    ><button type="button" :disabled="saving || !ready" @click="emit('merge')">
      {{ $t('admin-media.galleryForm.merge') }}
    </button>
  </section>
</template>
<script setup lang="ts">
import type { ManagedPhoto } from '~/features/gallery/types'
import type { GalleryRecovery } from '~/features/gallery/editor'
import { contentRelationSummary } from '~/features/content-relation/editor'
import type { EditorRecoveryCopy } from '~/utils/editorRecoveryStorage'

defineProps<{
  recovery: GalleryRecovery | null
  previousRecoveries: EditorRecoveryCopy<GalleryRecovery>[]
  serverVersion: ManagedPhoto | null
  ready: boolean
  saving: boolean
}>()
const emit = defineEmits<{ restore: []; discard: []; reload: []; merge: [] }>()
</script>
<style scoped lang="scss">
@use '~/assets/styles/gallery-editor' as gallery;

@include gallery.form;
</style>
