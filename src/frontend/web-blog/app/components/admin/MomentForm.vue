<!-- @file MomentForm.vue @description 动态编辑展示表单，数据与保存事件由页面提供 -->
<template>
  <form ref="editorForm" class="moment-editor" @submit.prevent="$emit('save', value.status)">
    <header class="moment-editor__heading">
      <h1>{{ id ? $t('admin-content.momentForm.editTitle') : $t('admin-content.momentForm.createTitle') }}</h1>
      <AdminBackLink to="/admin/moments">{{ $t('admin-content.momentForm.back') }}</AdminBackLink>
      <NuxtLink v-if="id && saved?.status === 'published'" :to="`/moments/${id}`">{{
        $t('admin-content.momentForm.viewPublic')
      }}</NuxtLink>
    </header>
    <p v-if="error" role="alert">
      {{ error }}
      <button type="button" :disabled="saving || loading" @click="$emit('reload')">
        {{ $t('admin-content.momentForm.reload') }}
      </button>
    </p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="localError" role="alert">
      {{ localError }}
      <button type="button" @click="$emit('persist')">{{ $t('admin-content.momentForm.retryPersist') }}</button>
    </p>
    <AdminMomentFormNotices
      :recovery="recovery"
      :server-version="serverVersion"
      :saving="saving"
      @restore="$emit('restore')"
      @discard="$emit('discard')"
      @reload="$emit('reload')"
    />
    <p v-if="loading" role="status">{{ $t('admin-content.momentForm.loading') }}</p>
    <fieldset :disabled="!ready || loading">
      <label
        >{{ $t('admin-content.momentForm.content')
        }}<textarea
          :value="value.content"
          :aria-label="$t('admin-content.momentForm.content')"
          rows="8"
          maxlength="10000"
          required
          :placeholder="$t('admin-content.momentForm.contentPlaceholder')"
          @input="change('content', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>
      <small>{{ value.content.length }} / 10000</small>
      <label
        >{{ $t('admin-content.momentForm.topics')
        }}<input
          :value="value.topics.join($t('admin-content.momentForm.topicJoiner'))"
          :aria-label="$t('admin-content.momentForm.topicsAria')"
          @change="
            change(
              'topics',
              ($event.target as HTMLInputElement).value
                .split(/[,，]/)
                .map((v) => v.trim().replace(/^#+/, ''))
                .filter(Boolean),
            )
          "
      /></label>
      <AdminMomentFormImages :images="value.images" @choose="mediaOpen = true" @change="change('images', $event)" />
      <div class="moment-editor__row">
        <label
          >{{ $t('admin-content.momentForm.location')
          }}<input
            :value="value.location"
            maxlength="160"
            @input="change('location', ($event.target as HTMLInputElement).value)"
        /></label>
        <label
          >{{ $t('admin-content.momentForm.device')
          }}<input
            :value="value.device"
            maxlength="80"
            @input="change('device', ($event.target as HTMLInputElement).value)"
        /></label>
        <label
          >{{ $t('admin-content.momentForm.mood')
          }}<input
            :value="value.mood"
            maxlength="80"
            @input="change('mood', ($event.target as HTMLInputElement).value)"
        /></label>
      </div>
      <AdminMomentFormLinkFields
        :value="value"
        :article-choices="articleChoices"
        :articles-pending="articlesPending"
        :articles-error="articlesError"
        @change="$emit('change', $event)"
        @search-articles="$emit('search-articles', $event)"
      />
      <div class="moment-editor__row">
        <label
          >{{ $t('admin-content.momentForm.saveStatus')
          }}<select
            :value="value.status"
            :aria-label="$t('admin-content.momentForm.saveStatusAria')"
            @change="change('status', ($event.target as HTMLSelectElement).value as MomentStatus)"
          >
            <option value="draft">{{ $t('admin-content.momentForm.status.draft') }}</option>
            <option value="published">{{ $t('admin-content.momentForm.status.published') }}</option>
            <option value="archived">{{ $t('admin-content.momentForm.status.archived') }}</option>
          </select></label
        >
        <label class="moment-editor__check"
          ><input
            :checked="value.isPinned"
            type="checkbox"
            @change="change('isPinned', ($event.target as HTMLInputElement).checked)"
          />{{ $t('admin-content.momentForm.pinned') }}</label
        >
      </div>
    </fieldset>
    <AdminActionBar class="moment-editor__actions">
      <CommonTooltip :content="$t('admin-content.momentForm.saveTooltip', { shortcut: saveShortcut })"
        ><button
          ref="saveButton"
          :aria-busy="saving"
          type="submit"
          aria-keyshortcuts="Control+S Meta+S"
          :disabled="!ready || loading || saving || !value.content.trim()"
        >
          {{ saving ? $t('admin-content.momentForm.saving') : $t('admin-content.momentForm.save') }}
        </button></CommonTooltip
      >
      <button
        type="button"
        :disabled="!ready || loading || saving || !value.content.trim()"
        @click="requestSave('draft')"
      >
        {{ $t('admin-content.momentForm.saveDraft') }}
      </button>
      <button
        type="button"
        :disabled="!ready || loading || saving || !value.content.trim()"
        @click="requestSave('published')"
      >
        {{ $t('admin-content.momentForm.publish') }}
      </button>
      <span>{{
        dirty
          ? $t('admin-content.momentForm.stateDirty')
          : saved
            ? $t('admin-content.momentForm.stateSaved')
            : $t('admin-content.momentForm.stateUnsaved')
      }}</span>
    </AdminActionBar>
    <ClientOnly><AdminMediaPicker v-model:open="mediaOpen" @selected="selectMedia" /></ClientOnly>
  </form>
</template>
<script setup lang="ts">
import type { ManagedMoment, MomentEditable, MomentStatus } from '~/features/moment/types'
import type { MomentRecovery } from '~/features/moment/editor'
import type { MediaAsset } from '~/features/media/types'
const props = defineProps<{
  value: MomentEditable
  id: string | null
  ready: boolean
  loading: boolean
  saving: boolean
  dirty: boolean
  saved: ManagedMoment | null
  serverVersion: ManagedMoment | null
  recovery: MomentRecovery | null
  error: string
  notice: string
  localError: string
  articleChoices: { id: number; title: string }[]
  articlesPending: boolean
  articlesError: string
}>()
const emit = defineEmits<{
  change: [value: Partial<MomentEditable>]
  save: [status: MomentStatus]
  reload: []
  restore: []
  discard: []
  persist: []
  'search-articles': [query: string]
}>()
const editorForm = ref<HTMLFormElement | null>(null),
  saveButton = ref<HTMLButtonElement | null>(null)
// Ctrl/⌘+S 复用“保存”按钮的表单提交；按钮禁用（未就绪、保存中、校验未过）或无修改时不提交。
const { label: saveShortcut } = useAdminSaveShortcut({
  form: editorForm,
  submitter: () => saveButton.value,
  dirty: () => props.dirty,
})
const mediaOpen = ref(false)
function requestSave(status: MomentStatus) {
  if (editorForm.value?.reportValidity()) emit('save', status)
}
function change<K extends keyof MomentEditable>(key: K, value: MomentEditable[K]) {
  emit('change', { [key]: value })
}
function selectMedia(asset: MediaAsset) {
  if (props.value.images.length < 9 && !props.value.images.includes(asset.url))
    change('images', [...props.value.images, asset.url])
}
</script>
<style scoped lang="scss">
@use '~/assets/styles/moment-editor' as moment;

@include moment.form;
</style>
