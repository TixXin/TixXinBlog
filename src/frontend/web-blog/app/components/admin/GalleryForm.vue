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
    <section v-if="recovery" class="gallery-editor__notice" :aria-label="$t('admin-media.galleryForm.recoveryLabel')">
      <h2>{{ $t('admin-media.galleryForm.recoveryTitle') }}</h2>
      <AdminGalleryRecoveryDetails :value="recovery.form" />
      <button type="button" :disabled="saving || !ready" @click="$emit('restore')">
        {{ $t('admin-media.galleryForm.restore') }}</button
      ><button type="button" :disabled="saving" @click="$emit('discard')">
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
    <section
      v-if="serverVersion"
      class="gallery-editor__notice"
      :aria-label="$t('admin-media.galleryForm.serverLabel')"
    >
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
      /><button type="button" :disabled="saving" @click="$emit('reload')">
        {{ $t('admin-media.galleryForm.loadServer') }}</button
      ><button type="button" :disabled="saving || !ready" @click="$emit('merge')">
        {{ $t('admin-media.galleryForm.merge') }}
      </button>
    </section>
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
              :aria-describedby="
                value.externalUrl && urlError ? 'gallery-url-help gallery-url-error' : 'gallery-url-help'
              "
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
          <button type="button" @click="mediaOpen = true">{{ $t('admin-media.galleryForm.pickMedia') }}</button
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
import { contentRelationSummary } from '~/features/content-relation/editor'
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
const previewState = ref('loading')
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
.gallery-editor {
  display: grid;
  gap: 1rem;
  max-width: 1000px;
  overflow-wrap: anywhere;
}
header,
footer,
.gallery-editor__row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}
h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-right: auto;
}
h2 {
  font-size: 1rem;
  font-weight: 600;
}
fieldset {
  display: grid;
  gap: 1rem;
  padding: 0;
  border: 0;
  min-width: 0;
}
label {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
}
.gallery-editor__row > label {
  flex: 1 1 180px;
}
input,
textarea,
select,
button {
  color: var(--text-main);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.65rem;
  max-width: 100%;
}
input,
textarea,
select {
  width: 100%;
  min-width: 0;
}
textarea {
  resize: vertical;
}
button {
  min-height: 44px;
  cursor: var(--interaction-cursor, pointer);
}
button:disabled {
  opacity: 0.5;
  cursor: var(--interaction-cursor, not-allowed);
}
p {
  color: var(--text-muted);
  line-height: 1.7;
}
a {
  color: var(--accent);
}
.gallery-editor__notice {
  padding: 1rem;
  border: 1px solid var(--accent);
  border-radius: 0.5rem;
}
.gallery-editor__notice p {
  white-space: pre-wrap;
}
.gallery-editor__preview {
  max-width: 360px;
  margin-block: 0.75rem;
}
</style>
