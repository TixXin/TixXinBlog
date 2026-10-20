<!-- @file LinkEditorForm.vue @description 友链管理表单，网址重复可修正，Logo来源互斥并保留编辑副本 -->
<template>
  <form ref="editorForm" class="link-editor" @submit.prevent="$emit('save', value.status)">
    <header>
      <h1>{{ id ? $t('admin-media.linkEditor.editTitle') : $t('admin-media.linkEditor.createTitle') }}</h1>
      <AdminBackLink to="/admin/links">{{ $t('admin-media.linkSettings.back') }}</AdminBackLink
      ><NuxtLink v-if="saved?.status === 'published'" :to="`/links?q=${encodeURIComponent(saved.name)}`">{{
        $t('admin-media.linkList.viewPublished')
      }}</NuxtLink>
    </header>
    <p v-if="error" role="alert">
      {{ error }}
      <button type="button" :disabled="saving || loading" @click="$emit('reload')">
        {{ $t('admin-media.linkForm.reload') }}
      </button>
    </p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="localError" role="alert">
      {{ localError }}
      <button type="button" @click="$emit('persist')">{{ $t('admin-media.linkForm.retryPersist') }}</button>
    </p>
    <section v-if="recovery" class="link-editor__notice" :aria-label="$t('admin-media.linkForm.recoveryLabel')">
      <h2>{{ $t('admin-media.linkForm.recoveryTitle') }}</h2>
      <AdminLinkRecoveryDetails :value="recovery.form" /><button
        type="button"
        :disabled="saving || !ready"
        @click="$emit('restore')"
      >
        {{ $t('admin-media.linkForm.restore') }}</button
      ><button type="button" :disabled="saving" @click="$emit('discard')">
        {{ $t('admin-media.linkForm.discard') }}
      </button>
    </section>
    <section
      v-if="previousRecoveries.length"
      class="link-editor__notice"
      :aria-label="$t('admin-media.linkForm.previousLabel')"
    >
      <h2>{{ $t('admin-media.linkForm.previousTitle') }}</h2>
      <p>{{ $t('admin-media.linkForm.previousBody') }}</p>
      <article v-for="copy in previousRecoveries" :key="copy.key">
        <p>{{ $t('admin-media.linkForm.savedAt', { time: copy.value.savedAt }) }}</p>
        <AdminLinkRecoveryDetails :value="copy.value.form" />
      </article>
    </section>
    <section v-if="serverVersion" class="link-editor__notice" :aria-label="$t('admin-media.linkForm.serverLabel')">
      <h2>{{ $t('admin-media.linkForm.serverTitle', { revision: serverVersion.revision }) }}</h2>
      <AdminLinkRecoveryDetails :value="serverVersion" /><button
        type="button"
        :disabled="saving"
        @click="$emit('reload')"
      >
        {{ $t('admin-media.linkForm.loadServer') }}</button
      ><button type="button" :disabled="saving || !ready" @click="$emit('merge')">
        {{ $t('admin-media.linkForm.merge') }}
      </button>
    </section>
    <p v-if="loading" role="status">{{ $t('admin-media.linkForm.loading') }}</p>
    <fieldset :disabled="!ready || loading">
      <label
        >{{ $t('admin-media.linkForm.name')
        }}<input
          :value="value.name"
          :aria-label="$t('admin-media.linkForm.nameLabel')"
          required
          maxlength="80"
          @input="change('name', ($event.target as HTMLInputElement).value)" /></label
      ><label
        >{{ $t('admin-media.linkForm.description')
        }}<textarea
          :value="value.description"
          :aria-label="$t('admin-media.linkForm.descriptionLabel')"
          rows="4"
          maxlength="300"
          @input="change('description', ($event.target as HTMLTextAreaElement).value)"
        /></label
      ><label
        >{{ $t('admin-media.linkForm.url')
        }}<input
          :value="value.url"
          :aria-label="$t('admin-media.linkForm.urlLabel')"
          type="url"
          pattern="https?://.+"
          required
          maxlength="2048"
          placeholder="https://example.com"
          @input="change('url', ($event.target as HTMLInputElement).value)"
      /></label>
      <p>{{ $t('admin-media.linkForm.urlHelp') }}</p>
      <section :aria-label="$t('admin-media.linkForm.logoSection')">
        <h2>{{ $t('admin-media.linkForm.logoTitle') }}</h2>
        <div class="link-editor__row">
          <button type="button" @click="mediaOpen = true">{{ $t('admin-media.linkForm.pickLogo') }}</button
          ><button
            v-if="value.logoMediaId || value.logoUrl"
            type="button"
            @click="$emit('change', { logoMediaId: null, logoUrl: null })"
          >
            {{ $t('admin-media.linkForm.removeLogo') }}
          </button>
        </div>
        <label
          >{{ $t('admin-media.linkForm.logoUrl')
          }}<input
            :value="value.logoUrl ?? ''"
            :aria-label="$t('admin-media.linkForm.logoUrlLabel')"
            type="url"
            pattern="https://.+"
            maxlength="2048"
            placeholder="https://example.com/logo.png"
            @input="
              $emit('change', { logoMediaId: null, logoUrl: ($event.target as HTMLInputElement).value || null })
            " /></label
        ><CommonImageFrame
          v-if="value.logoMediaId"
          class="link-editor__logo"
          :src="`/api/v1/media/${value.logoMediaId}.webp`"
          :alt="value.name || $t('admin-media.linkForm.logoAlt')"
          :width="selectedMedia?.id === value.logoMediaId ? selectedMedia.width : (saved?.width ?? undefined)"
          :height="selectedMedia?.id === value.logoMediaId ? selectedMedia.height : (saved?.height ?? undefined)"
          fit="contain"
        /><CommonImageFrame
          v-else-if="saved?.logoUrl && saved.logoUrl === value.logoUrl"
          class="link-editor__logo"
          :src="saved.logoUrl"
          :alt="value.name || $t('admin-media.linkForm.logoAlt')"
          fit="contain"
        />
        <p v-else>
          {{ value.logoUrl ? $t('admin-media.linkForm.logoUrlPending') : $t('admin-media.linkForm.logoNone') }}
        </p>
        <p>{{ $t('admin-media.linkForm.logoHelp') }}</p>
      </section>
      <div class="link-editor__row">
        <label
          >{{ $t('admin-media.linkForm.status')
          }}<select
            :value="value.status"
            :aria-label="$t('admin-media.linkForm.statusLabel')"
            @change="change('status', ($event.target as HTMLSelectElement).value as LinkStatus)"
          >
            <option v-for="status in linkStatuses" :key="status" :value="status">
              {{ linkStatusLabel(status, t) }}
            </option>
          </select></label
        ><label
          >{{ $t('admin-media.linkForm.sortOrder')
          }}<input
            :value="value.sortOrder"
            :aria-label="$t('admin-media.linkForm.sortOrderLabel')"
            type="number"
            step="1"
            min="-1000000"
            max="1000000"
            @input="change('sortOrder', Number(($event.target as HTMLInputElement).value))" /></label
        ><label class="link-editor__check"
          ><input
            :checked="value.isFeatured"
            :aria-label="$t('admin-media.linkForm.featured')"
            type="checkbox"
            @change="change('isFeatured', ($event.target as HTMLInputElement).checked)"
          />{{ $t('admin-media.linkForm.featured') }}</label
        >
      </div>
      <p>{{ $t('admin-media.linkForm.featuredHelp') }}</p>
    </fieldset>
    <p v-if="saved">
      {{ $t('admin-media.linkForm.createdAt', { time: saved.createdAt })
      }}<template v-if="saved.publishedAt">{{
        $t('admin-media.linkForm.publishedAt', { time: saved.publishedAt })
      }}</template>
      {{ $t('admin-media.linkForm.revision', { revision: saved.revision }) }}
    </p>
    <AdminActionBar>
      <CommonTooltip :content="$t('admin-media.gallerySettings.saveTooltip', { shortcut: saveShortcut })"
        ><button
          ref="saveButton"
          :aria-busy="saving"
          type="submit"
          aria-keyshortcuts="Control+S Meta+S"
          :disabled="!ready || loading || saving || !value.name.trim() || !value.url.trim()"
        >
          {{ saving ? $t('admin-media.linkForm.saving') : $t('admin-media.linkForm.save') }}
        </button></CommonTooltip
      ><button
        type="button"
        :disabled="!ready || loading || saving || !value.name.trim() || !value.url.trim()"
        @click="requestSave('draft')"
      >
        {{ $t('admin-media.linkForm.saveDraft') }}</button
      ><button
        type="button"
        :disabled="!ready || loading || saving || !value.name.trim() || !value.url.trim()"
        @click="requestSave('published')"
      >
        {{ $t('admin-media.linkList.publish') }}</button
      ><span>{{
        dirty
          ? $t('admin-media.linkForm.dirty')
          : saved
            ? $t('admin-media.linkForm.clean')
            : $t('admin-media.linkForm.unsaved')
      }}</span>
    </AdminActionBar>
    <ClientOnly><AdminMediaPicker v-model:open="mediaOpen" @selected="selectMedia" /></ClientOnly>
  </form>
</template>
<script setup lang="ts">
import { linkStatusLabel, linkStatuses } from '~/features/link/types'
import type { LinkEditable, LinkStatus, ManagedLink } from '~/features/link/types'
import type { LinkRecovery } from '~/features/link/editor'
import type { MediaAsset } from '~/features/media/types'
import type { EditorRecoveryCopy } from '~/utils/editorRecoveryStorage'
const props = defineProps<{
  value: LinkEditable
  id: number | null
  saved: ManagedLink | null
  serverVersion: ManagedLink | null
  recovery: LinkRecovery | null
  previousRecoveries: EditorRecoveryCopy<LinkRecovery>[]
  ready: boolean
  loading: boolean
  saving: boolean
  dirty: boolean
  error: string
  notice: string
  localError: string
}>()
const { t } = useI18n()
const emit = defineEmits<{
  change: [value: Partial<LinkEditable>]
  save: [status: LinkStatus]
  reload: []
  restore: []
  discard: []
  persist: []
  merge: []
}>()
const editorForm = ref<HTMLFormElement | null>(null),
  saveButton = ref<HTMLButtonElement | null>(null)
// Ctrl/⌘+S 复用“保存”按钮的表单提交；按钮禁用（未就绪、保存中、校验未过）或无修改时不提交。
const { label: saveShortcut } = useAdminSaveShortcut({
  form: editorForm,
  submitter: () => saveButton.value,
  dirty: () => props.dirty,
})
const mediaOpen = ref(false),
  selectedMedia = ref<MediaAsset | null>(null)
function requestSave(status: LinkStatus) {
  if (editorForm.value?.reportValidity()) emit('save', status)
}
function change<K extends keyof LinkEditable>(key: K, value: LinkEditable[K]) {
  emit('change', { [key]: value })
}
function selectMedia(asset: MediaAsset) {
  selectedMedia.value = asset
  emit('change', { logoMediaId: asset.id, logoUrl: null })
}
</script>
<style scoped lang="scss">
.link-editor {
  display: grid;
  gap: 1rem;
  max-width: 1000px;
  overflow-wrap: anywhere;
}
header,
footer,
.link-editor__row {
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
  border: 0;
  padding: 0;
  display: grid;
  gap: 1rem;
  min-width: 0;
}
label {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
}
.link-editor__row > label {
  flex: 1 1 180px;
}

input,
textarea,
select {
  width: 100%;
}
textarea {
  resize: vertical;
}

p {
  color: var(--text-muted);
  line-height: 1.7;
}
a {
  color: var(--accent);
}
.link-editor__notice {
  padding: 1rem;
  border: 1px solid var(--accent);
  border-radius: 0.5rem;
}
.link-editor__logo {
  max-width: 200px;
  margin-block: 0.75rem;
}
.link-editor__check {
  display: flex;
  align-items: center;
}
.link-editor__check input {
  width: auto;
}
</style>
