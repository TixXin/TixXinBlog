<!-- @file GalleryForm.vue @description 图库作品编辑表单，媒体文件与作品发布状态分别说明 -->
<template>
  <form ref="editorForm" class="gallery-editor" @submit.prevent="$emit('save', value.status)">
    <header>
      <h1>{{ id ? $t('admin-media.galleryEditor.editTitle') : $t('admin-media.galleryEditor.createTitle') }}</h1>
      <AdminBackLink to="/admin/gallery">{{ $t('admin-media.galleryForm.back') }}</AdminBackLink
      ><NuxtLink v-if="saved?.status === 'published'" :to="`/gallery?photo=${id}`">{{
        $t('admin-media.galleryForm.viewPublished')
      }}</NuxtLink>
    </header>
    <p v-if="error" role="alert">
      {{ error }}
      <button type="button" :disabled="saving || loading" @click="$emit('reload')">
        {{ $t('admin-media.galleryForm.reload') }}
      </button>
    </p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="localError" role="alert">
      {{ localError }}
      <button type="button" @click="$emit('persist')">{{ $t('admin-media.galleryForm.retryPersist') }}</button>
    </p>
    <AdminGalleryFormNotices
      :recovery="recovery"
      :previous-recoveries="previousRecoveries"
      :server-version="serverVersion"
      :ready="ready"
      :saving="saving"
      @restore="$emit('restore')"
      @discard="$emit('discard')"
      @reload="$emit('reload')"
      @merge="$emit('merge')"
    />
    <p v-if="loading" role="status">{{ $t('admin-media.galleryForm.loading') }}</p>
    <fieldset :disabled="!ready || loading">
      <label
        >{{ $t('admin-media.galleryForm.title')
        }}<input
          :value="value.title"
          :aria-label="$t('admin-media.galleryForm.title')"
          required
          maxlength="160"
          @input="change('title', ($event.target as HTMLInputElement).value)"
      /></label>
      <label
        >{{ $t('admin-media.galleryForm.description')
        }}<textarea
          :value="value.description"
          :aria-label="$t('admin-media.galleryForm.description')"
          maxlength="5000"
          rows="5"
          @input="change('description', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>
      <AdminGalleryFormImage
        :value="value"
        :saved="saved"
        :selected-media="selectedMedia"
        :url-error="urlError"
        @change="$emit('change', $event)"
        @pick="mediaOpen = true"
      />
      <div class="gallery-editor__row">
        <label
          >{{ $t('admin-media.galleryList.category')
          }}<input
            :value="value.category"
            :aria-label="$t('admin-media.galleryForm.categoryLabel')"
            maxlength="40"
            :placeholder="$t('admin-media.galleryForm.categoryPlaceholder')"
            @input="change('category', ($event.target as HTMLInputElement).value)" /></label
        ><label
          >{{ $t('admin-media.galleryForm.takenOn')
          }}<CommonDatePicker
            :model-value="value.takenOn ?? ''"
            :aria-label="$t('admin-media.galleryForm.takenOn')"
            clearable
            @update:model-value="change('takenOn', $event || null)"
        /></label>
      </div>
      <p>{{ $t('admin-media.galleryForm.metaHelp') }}</p>
      <div class="gallery-editor__row">
        <label
          >{{ $t('admin-media.galleryForm.location')
          }}<input
            :value="value.location"
            :aria-label="$t('admin-media.galleryForm.location')"
            maxlength="160"
            @input="change('location', ($event.target as HTMLInputElement).value)" /></label
        ><label
          >{{ $t('admin-media.galleryForm.device')
          }}<input
            :value="value.device"
            :aria-label="$t('admin-media.galleryForm.device')"
            maxlength="160"
            @input="change('device', ($event.target as HTMLInputElement).value)"
        /></label>
      </div>
      <div class="gallery-editor__row">
        <label
          >{{ $t('admin-media.galleryForm.status')
          }}<select
            :value="value.status"
            :aria-label="$t('admin-media.galleryForm.statusLabel')"
            @change="change('status', ($event.target as HTMLSelectElement).value as GalleryStatus)"
          >
            <option value="draft">{{ $t('admin-media.galleryList.statusLabel.draft') }}</option>
            <option value="published">{{ $t('admin-media.galleryList.statusLabel.published') }}</option>
            <option value="withdrawn">{{ $t('admin-media.galleryList.statusLabel.withdrawn') }}</option>
          </select></label
        ><label
          >{{ $t('admin-media.galleryForm.sortOrder')
          }}<input
            :value="value.sortOrder"
            :aria-label="$t('admin-media.galleryForm.sortOrderLabel')"
            type="number"
            min="-1000000"
            max="1000000"
            step="1"
            @input="change('sortOrder', Number(($event.target as HTMLInputElement).value))"
        /></label>
      </div>
      <AdminContentRelations
        v-bind="relations.props.value"
        @choose="relations.choose"
        @remove="relations.remove"
        @move="relations.move"
        @search="relations.search"
        @page="relations.setPage"
        @type="relations.setType"
        @query="relations.setQuery"
        @resolve="relations.resolve"
      />
    </fieldset>
    <p v-if="saved">
      {{ $t('admin-media.galleryForm.createdAt', { time: saved.createdAt })
      }}<template v-if="saved.publishedAt">{{
        $t('admin-media.galleryForm.publishedAt', { time: saved.publishedAt })
      }}</template>
      {{ $t('admin-media.galleryForm.revision', { revision: saved.revision }) }}
    </p>
    <AdminActionBar>
      <CommonTooltip :content="$t('admin-media.gallerySettings.saveTooltip', { shortcut: saveShortcut })"
        ><button
          ref="saveButton"
          :aria-busy="saving"
          type="submit"
          aria-keyshortcuts="Control+S Meta+S"
          :disabled="!ready || saving || loading || !value.title.trim() || !sourceValid"
        >
          {{ saving ? $t('admin-media.galleryForm.saving') : $t('admin-media.galleryForm.save') }}
        </button></CommonTooltip
      ><button
        type="button"
        :disabled="!ready || saving || loading || !value.title.trim() || !sourceValid"
        @click="requestSave('draft')"
      >
        {{ $t('admin-media.galleryForm.saveDraft') }}</button
      ><button
        type="button"
        :disabled="!ready || saving || loading || !value.title.trim() || !sourceValid"
        @click="requestSave('published')"
      >
        {{ $t('admin-media.galleryList.publish') }}</button
      ><span>{{
        dirty
          ? $t('admin-media.galleryForm.dirty')
          : saved
            ? $t('admin-media.galleryForm.clean')
            : $t('admin-media.galleryForm.unsaved')
      }}</span>
    </AdminActionBar>
    <ClientOnly><AdminMediaPicker v-model:open="mediaOpen" @selected="selectMedia" /></ClientOnly>
  </form>
</template>
<script setup lang="ts">
import type { GalleryEditable, GalleryStatus, ManagedPhoto } from '~/features/gallery/types'
import type { GalleryRecovery } from '~/features/gallery/editor'
import { galleryUrlError } from '~/features/gallery/editor'
import type { MediaAsset } from '~/features/media/types'
import type { EditorRecoveryCopy } from '~/utils/editorRecoveryStorage'
const props = defineProps<{
  value: GalleryEditable
  id: number | null
  saved: ManagedPhoto | null
  serverVersion: ManagedPhoto | null
  recovery: GalleryRecovery | null
  previousRecoveries: EditorRecoveryCopy<GalleryRecovery>[]
  ready: boolean
  loading: boolean
  saving: boolean
  dirty: boolean
  error: string
  notice: string
  localError: string
}>()
const { t } = useI18n()
const urlError = computed(() => galleryUrlError(props.value.externalUrl, t))
const sourceValid = computed(() => (props.value.source === 'external' ? !urlError.value : !!props.value.mediaId))
const emit = defineEmits<{
  change: [value: Partial<GalleryEditable>]
  save: [status: GalleryStatus]
  reload: []
  restore: []
  discard: []
  persist: []
  merge: []
}>()
const editorForm = ref<HTMLFormElement | null>(null),
  saveButton = ref<HTMLButtonElement | null>(null)
// 显式草稿和发布按钮同样先校验日期、排序等原生约束，保持与主提交一致。
function requestSave(status: GalleryStatus) {
  if (editorForm.value?.reportValidity()) emit('save', status)
}
// Ctrl/⌘+S 复用“保存”按钮的表单提交；按钮禁用（未就绪、保存中、校验未过）或无修改时不提交。
const { label: saveShortcut } = useAdminSaveShortcut({
  form: editorForm,
  submitter: () => saveButton.value,
  dirty: () => props.dirty,
})
const mediaOpen = ref(false)
const selectedMedia = ref<MediaAsset | null>(null)
function change<K extends keyof GalleryEditable>(key: K, value: GalleryEditable[K]) {
  emit('change', { [key]: value })
}
const relations = useContentRelationPicker(
  computed(() => props.value.relatedContent ?? []),
  computed(() => (props.id ? { type: 'gallery' as const, id: props.id } : undefined)),
  computed(() => props.ready && !props.saving && !props.loading),
  (relatedContent) => emit('change', { relatedContent }),
)
function selectMedia(asset: MediaAsset) {
  selectedMedia.value = asset
  change('mediaId', asset.id)
}
</script>
<style scoped lang="scss">
@use '~/assets/styles/gallery-editor' as gallery;

@include gallery.form;
</style>
