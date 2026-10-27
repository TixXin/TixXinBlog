<!-- @file GalleryFormImage.vue @description 图库编辑表单的图片区块：媒体库与外链两种来源，外链校验、预览加载状态与媒体尺寸 -->
<template>
  <section>
    <h2>{{ $t('admin-media.galleryForm.image') }}</h2>
    <label
      >{{ $t('admin-media.galleryForm.source')
      }}<select
        :value="value.source"
        :aria-label="$t('admin-media.galleryForm.source')"
        @change="change('source', ($event.target as HTMLSelectElement).value as GalleryEditable['source'])"
      >
        <option value="media">{{ $t('admin-media.galleryForm.sourceMedia') }}</option>
        <option value="external">{{ $t('admin-media.galleryForm.sourceExternal') }}</option>
      </select></label
    >
    <div v-if="value.source === 'external'">
      <label
        >{{ $t('admin-media.galleryForm.externalUrl')
        }}<input
          :value="value.externalUrl"
          :aria-label="$t('admin-media.galleryForm.externalUrl')"
          type="url"
          maxlength="2048"
          :aria-invalid="!!value.externalUrl && !!urlError"
          :aria-describedby="value.externalUrl && urlError ? 'gallery-url-help gallery-url-error' : 'gallery-url-help'"
          @input="change('externalUrl', ($event.target as HTMLInputElement).value)"
      /></label>
      <p id="gallery-url-help">
        {{ $t('admin-media.galleryForm.externalHelp') }}
      </p>
      <p v-if="value.externalUrl && urlError" id="gallery-url-error" role="alert">{{ urlError }}</p>
      <template v-else-if="value.externalUrl">
        <p>{{ $t('admin-media.galleryForm.externalValid') }}</p>
        <CommonImageFrame
          :key="value.externalUrl"
          class="gallery-editor__preview"
          :src="value.externalUrl"
          :alt="value.title || $t('admin-media.galleryForm.externalPreviewAlt')"
          fit="contain"
          loading="eager"
          @state="previewState = $event"
        />
        <p role="status">
          {{
            previewState === 'ready'
              ? $t('admin-media.galleryForm.previewReady')
              : previewState === 'error'
                ? $t('admin-media.galleryForm.previewError')
                : $t('admin-media.galleryForm.previewLoading')
          }}
        </p>
      </template>
    </div>
    <template v-else>
      <button type="button" @click="emit('pick')">{{ $t('admin-media.galleryForm.pickMedia') }}</button
      ><CommonImageFrame
        v-if="value.mediaId"
        class="gallery-editor__preview"
        :src="`/api/v1/media/${value.mediaId}.webp`"
        :alt="value.title || $t('admin-media.galleryForm.imageAlt')"
        fit="contain"
        :width="
          selectedMedia?.id === value.mediaId
            ? selectedMedia.width
            : saved?.mediaId === value.mediaId
              ? saved.width
              : undefined
        "
        :height="
          selectedMedia?.id === value.mediaId
            ? selectedMedia.height
            : saved?.mediaId === value.mediaId
              ? saved.height
              : undefined
        "
      />
      <p>
        {{ $t('admin-media.galleryForm.mediaHelp') }}
      </p>
    </template>
    <p>{{ $t('admin-media.galleryForm.sourceHelp') }}</p>
  </section>
</template>
<script setup lang="ts">
import type { GalleryEditable, ManagedPhoto } from '~/features/gallery/types'
import type { MediaAsset } from '~/features/media/types'

defineProps<{
  value: GalleryEditable
  saved: ManagedPhoto | null
  selectedMedia: MediaAsset | null
  urlError: string
}>()
const emit = defineEmits<{ change: [value: Partial<GalleryEditable>]; pick: [] }>()
const previewState = ref('loading')
function change<K extends keyof GalleryEditable>(key: K, value: GalleryEditable[K]) {
  emit('change', { [key]: value })
}
</script>
<style scoped lang="scss">
@use '~/assets/styles/gallery-editor' as gallery;

@include gallery.form;
</style>
