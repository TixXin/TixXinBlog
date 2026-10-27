<!-- @file ProjectForm.vue @description 项目编辑展示表单，公开状态、项目进展和媒体文件分别管理 -->
<template>
  <form ref="editorForm" class="project-editor" @submit.prevent="$emit('save', value.status)">
    <header>
      <h1>{{ id ? $t('admin-media.projectForm.editTitle') : $t('admin-media.projectForm.createTitle') }}</h1>
      <AdminBackLink to="/admin/projects">{{ $t('admin-media.projectForm.back') }}</AdminBackLink
      ><NuxtLink v-if="saved?.status === 'published'" :to="`/projects?project=${saved.id}`">{{
        $t('admin-media.projectForm.viewPublic')
      }}</NuxtLink>
    </header>
    <p v-if="error" role="alert">
      {{ error }}
      <button type="button" :disabled="saving || loading" @click="$emit('reload')">
        {{ $t('admin-media.projectForm.reload') }}
      </button>
    </p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="localError" role="alert">
      {{ localError }}
      <button type="button" @click="$emit('persist')">{{ $t('admin-media.projectForm.retryLocal') }}</button>
    </p>
    <AdminProjectFormNotices
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
    <p v-if="loading" role="status">{{ $t('admin-media.projectForm.loading') }}</p>
    <fieldset :disabled="!ready || loading">
      <label
        >{{ $t('admin-media.projectForm.title')
        }}<input
          :value="value.title"
          :aria-label="$t('admin-media.projectForm.title')"
          required
          maxlength="160"
          @input="change('title', ($event.target as HTMLInputElement).value)"
      /></label>
      <label
        >{{ $t('admin-media.projectForm.description')
        }}<textarea
          :value="value.description"
          :aria-label="$t('admin-media.projectForm.description')"
          rows="6"
          maxlength="5000"
          @input="change('description', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>
      <AdminProjectFormCover
        :cover-media-id="value.coverMediaId"
        :title="value.title"
        :saved="saved"
        :selected-media="selectedMedia"
        @choose="mediaOpen = true"
        @remove="change('coverMediaId', null)"
      />
      <div class="project-editor__row">
        <label
          >{{ $t('admin-media.projectForm.progress')
          }}<select
            :value="value.progress"
            :aria-label="$t('admin-media.projectForm.progress')"
            @change="change('progress', ($event.target as HTMLSelectElement).value as ProjectProgress)"
          >
            <option v-for="progress in projectProgresses" :key="progress" :value="progress">
              {{ projectProgressLabel(progress, t) }}
            </option>
          </select></label
        ><label
          >{{ $t('admin-media.projectForm.status')
          }}<select
            :value="value.status"
            :aria-label="$t('admin-media.projectForm.statusLabel')"
            @change="change('status', ($event.target as HTMLSelectElement).value as ProjectPublicationStatus)"
          >
            <option v-for="status in projectStatuses" :key="status" :value="status">
              {{ projectStatusLabel(status, t) }}
            </option>
          </select></label
        ><label
          >{{ $t('admin-media.projectForm.sortOrder')
          }}<input
            :value="value.sortOrder"
            :aria-label="$t('admin-media.projectForm.sortOrderLabel')"
            type="number"
            min="-1000000"
            max="1000000"
            step="1"
            @input="change('sortOrder', Number(($event.target as HTMLInputElement).value))"
        /></label>
      </div>
      <p>{{ $t('admin-media.projectForm.progressHint') }}</p>
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
      <AdminProjectFormTags :tags="value.tags" @change="change('tags', $event)" />
      <AdminProjectFormLinks :links="value.links" @change="change('links', $event)" />
    </fieldset>
    <p v-if="saved">
      {{ $t('admin-media.projectForm.createdAt', { time: saved.createdAt })
      }}<template v-if="saved.publishedAt">{{
        $t('admin-media.projectForm.publishedAt', { time: saved.publishedAt })
      }}</template
      >{{ $t('admin-media.projectForm.revision', { revision: saved.revision }) }}
    </p>
    <AdminActionBar>
      <CommonTooltip :content="$t('admin-media.projectForm.saveTooltip', { shortcut: saveShortcut })"
        ><button
          ref="saveButton"
          :aria-busy="saving"
          type="submit"
          aria-keyshortcuts="Control+S Meta+S"
          :disabled="!ready || loading || saving || !value.title.trim()"
        >
          {{ saving ? $t('admin-media.projectForm.saving') : $t('admin-media.projectForm.save') }}
        </button></CommonTooltip
      ><button
        type="button"
        :disabled="!ready || loading || saving || !value.title.trim()"
        @click="requestSave('draft')"
      >
        {{ $t('admin-media.projectForm.saveDraft') }}</button
      ><button
        type="button"
        :disabled="!ready || loading || saving || !value.title.trim()"
        @click="requestSave('published')"
      >
        {{ $t('admin-media.projectForm.publish') }}</button
      ><span>{{
        dirty
          ? $t('admin-media.projectForm.dirty')
          : saved
            ? $t('admin-media.projectForm.clean')
            : $t('admin-media.projectForm.unsaved')
      }}</span>
    </AdminActionBar>
    <ClientOnly><AdminMediaPicker v-model:open="mediaOpen" @selected="selectMedia" /></ClientOnly>
  </form>
</template>
<script setup lang="ts">
import {
  projectProgresses,
  projectProgressLabel,
  projectStatusLabel,
  projectStatusLabels,
} from '~/features/project/types'
import type {
  ManagedProject,
  ProjectEditable,
  ProjectProgress,
  ProjectPublicationStatus,
} from '~/features/project/types'
import type { ProjectRecovery } from '~/features/project/editor'
import type { MediaAsset } from '~/features/media/types'
import type { EditorRecoveryCopy } from '~/utils/editorRecoveryStorage'
const props = defineProps<{
  value: ProjectEditable
  id: number | null
  saved: ManagedProject | null
  serverVersion: ManagedProject | null
  recovery: ProjectRecovery | null
  previousRecoveries: EditorRecoveryCopy<ProjectRecovery>[]
  ready: boolean
  loading: boolean
  saving: boolean
  dirty: boolean
  error: string
  notice: string
  localError: string
}>()
const emit = defineEmits<{
  change: [value: Partial<ProjectEditable>]
  save: [status: ProjectPublicationStatus]
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
const { t } = useI18n()
const projectStatuses = Object.keys(projectStatusLabels) as ProjectPublicationStatus[]
function requestSave(status: ProjectPublicationStatus) {
  if (editorForm.value?.reportValidity()) emit('save', status)
}
function change<K extends keyof ProjectEditable>(key: K, value: ProjectEditable[K]) {
  emit('change', { [key]: value })
}
const relations = useContentRelationPicker(
  computed(() => props.value.relatedContent ?? []),
  computed(() => (props.id ? { type: 'project' as const, id: props.id } : undefined)),
  computed(() => props.ready && !props.saving && !props.loading),
  (relatedContent) => emit('change', { relatedContent }),
)
function selectMedia(asset: MediaAsset) {
  selectedMedia.value = asset
  change('coverMediaId', asset.id)
}
</script>
<style scoped lang="scss">
@use '~/assets/styles/project-editor' as project;

@include project.form;
</style>
