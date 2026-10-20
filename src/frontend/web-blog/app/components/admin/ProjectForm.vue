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
    <section v-if="recovery" class="project-editor__notice" :aria-label="$t('admin-media.projectForm.recoveryLabel')">
      <h2>{{ $t('admin-media.projectForm.recoveryTitle') }}</h2>
      <AdminProjectRecoveryDetails :value="recovery.form" />
      <button type="button" :disabled="saving || !ready" @click="$emit('restore')">
        {{ $t('admin-media.projectForm.restore') }}</button
      ><button type="button" :disabled="saving" @click="$emit('discard')">
        {{ $t('admin-media.projectForm.discardRecovery') }}
      </button>
    </section>
    <section
      v-if="previousRecoveries.length"
      class="project-editor__notice"
      :aria-label="$t('admin-media.projectForm.previousLabel')"
    >
      <h2>{{ $t('admin-media.projectForm.previousTitle') }}</h2>
      <p>{{ $t('admin-media.projectForm.previousBody') }}</p>
      <article v-for="copy in previousRecoveries" :key="copy.key">
        <p>{{ $t('admin-media.projectForm.savedAt', { time: copy.value.savedAt }) }}</p>
        <AdminProjectRecoveryDetails :value="copy.value.form" />
      </article>
    </section>
    <section
      v-if="serverVersion"
      class="project-editor__notice"
      :aria-label="$t('admin-media.projectForm.serverLabel')"
    >
      <h2>{{ $t('admin-media.projectForm.serverTitle', { revision: serverVersion.revision }) }}</h2>
      <p>
        {{
          $t('admin-media.projectForm.serverMeta', {
            title: serverVersion.title,
            status: projectStatusLabel(serverVersion.status, t),
            progress: projectProgressLabel(serverVersion.progress, t),
            sort: serverVersion.sortOrder,
          })
        }}
      </p>
      <p>{{ serverVersion.description }}</p>
      <p>
        {{
          $t('admin-media.projectForm.serverRelations', {
            relations: contentRelationSummary(serverVersion.relatedContent, $t),
          })
        }}
      </p>
      <p>
        {{
          $t('admin-media.projectForm.serverTags', {
            tags:
              serverVersion.tags.map((tag) => tag.label).join($t('admin-media.projectForm.tagSeparator')) ||
              $t('admin-media.projectForm.notFilled'),
          })
        }}
      </p>
      <ul>
        <li v-for="link in serverVersion.links" :key="link.kind">
          {{ $t('admin-media.projectForm.serverLink', { kind: projectLinkLabel(link.kind, t), href: link.href }) }}
        </li>
      </ul>
      <CommonImageFrame
        v-if="serverVersion.cover"
        class="project-editor__preview"
        :src="serverVersion.cover"
        :alt="serverVersion.title"
        :width="serverVersion.width ?? undefined"
        :height="serverVersion.height ?? undefined"
        fit="contain"
      />
      <p v-else>{{ $t('admin-media.projectForm.noCover') }}</p>
      <button type="button" :disabled="saving" @click="$emit('reload')">
        {{ $t('admin-media.projectForm.loadServer') }}</button
      ><button type="button" :disabled="saving || !ready" @click="$emit('merge')">
        {{ $t('admin-media.projectForm.merge') }}
      </button>
    </section>
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
      <section :aria-label="$t('admin-media.projectForm.cover')">
        <h2>{{ $t('admin-media.projectForm.cover') }}</h2>
        <button type="button" @click="mediaOpen = true">{{ $t('admin-media.projectForm.chooseCover') }}</button
        ><button v-if="value.coverMediaId" type="button" @click="change('coverMediaId', null)">
          {{ $t('admin-media.projectForm.removeCover') }}</button
        ><CommonImageFrame
          v-if="value.coverMediaId"
          class="project-editor__preview"
          :src="`/api/v1/media/${value.coverMediaId}.webp`"
          :alt="value.title || $t('admin-media.projectForm.cover')"
          :width="
            selectedMedia?.id === value.coverMediaId
              ? selectedMedia.width
              : saved?.coverMediaId === value.coverMediaId
                ? (saved.width ?? undefined)
                : undefined
          "
          :height="
            selectedMedia?.id === value.coverMediaId
              ? selectedMedia.height
              : saved?.coverMediaId === value.coverMediaId
                ? (saved.height ?? undefined)
                : undefined
          "
          fit="contain"
        />
        <p v-else>{{ $t('admin-media.projectForm.noCoverHint') }}</p>
        <p>{{ $t('admin-media.projectForm.mediaHint') }}</p>
      </section>
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
      <section :aria-label="$t('admin-media.projectForm.tagsLabel')">
        <h2>{{ $t('admin-media.projectForm.tagsTitle', { count: value.tags.length, max: 20 }) }}</h2>
        <div v-for="(tag, index) in value.tags" :key="index" class="project-editor__row">
          <label
            >{{ $t('admin-media.projectForm.tagName')
            }}<input
              :value="tag.label"
              :aria-label="$t('admin-media.projectForm.tagNameLabel', { index: index + 1 })"
              maxlength="40"
              required
              @input="changeTag(index, { label: ($event.target as HTMLInputElement).value })" /></label
          ><label
            >{{ $t('admin-media.projectForm.tagColor')
            }}<select
              :value="tag.color"
              :aria-label="$t('admin-media.projectForm.tagColorLabel', { index: index + 1 })"
              @change="changeTag(index, { color: ($event.target as HTMLSelectElement).value as ProjectTag['color'] })"
            >
              <option v-for="color in projectTagColors" :key="color" :value="color">
                {{ $t(`admin-media.projectForm.color.${color}`) }}
              </option>
            </select></label
          ><button
            type="button"
            :aria-label="$t('admin-media.projectForm.removeTagLabel', { index: index + 1 })"
            @click="
              change(
                'tags',
                value.tags.filter((_, i) => i !== index),
              )
            "
          >
            {{ $t('admin-media.projectForm.removeTag') }}
          </button>
        </div>
        <button
          type="button"
          :disabled="value.tags.length >= 20"
          @click="change('tags', [...value.tags, { label: '', color: 'blue' }])"
        >
          {{ $t('admin-media.projectForm.addTag') }}
        </button>
        <p>{{ $t('admin-media.projectForm.tagsHint') }}</p>
      </section>
      <section :aria-label="$t('admin-media.projectForm.linksLabel')">
        <h2>{{ $t('admin-media.projectForm.linksTitle', { count: value.links.length, max: 4 }) }}</h2>
        <div v-for="(link, index) in value.links" :key="index" class="project-editor__row">
          <label
            >{{ $t('admin-media.projectForm.linkKind')
            }}<select
              :value="link.kind"
              :aria-label="$t('admin-media.projectForm.linkKindLabel', { index: index + 1 })"
              @change="changeLink(index, { kind: ($event.target as HTMLSelectElement).value as ProjectLinkKind })"
            >
              <option
                v-for="kind in projectLinkKinds"
                :key="kind"
                :value="kind"
                :disabled="value.links.some((other, i) => i !== index && other.kind === kind)"
              >
                {{ projectLinkLabel(kind, t) }}
              </option>
            </select></label
          ><label
            >{{ $t('admin-media.projectForm.linkHref')
            }}<input
              :value="link.href"
              :aria-label="$t('admin-media.projectForm.linkHrefLabel', { index: index + 1 })"
              type="url"
              pattern="https?://.+"
              required
              maxlength="2048"
              placeholder="https://"
              @input="changeLink(index, { href: ($event.target as HTMLInputElement).value })" /></label
          ><button
            type="button"
            :aria-label="$t('admin-media.projectForm.removeLinkLabel', { index: index + 1 })"
            @click="
              change(
                'links',
                value.links.filter((_, i) => i !== index),
              )
            "
          >
            {{ $t('admin-media.projectForm.removeLink') }}
          </button>
        </div>
        <button type="button" :disabled="value.links.length >= 4" @click="addLink">
          {{ $t('admin-media.projectForm.addLink') }}
        </button>
        <p v-if="!value.links.length">{{ $t('admin-media.projectForm.noLinks') }}</p>
      </section>
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
  projectLinkLabel,
  projectLinkLabels,
  projectProgresses,
  projectProgressLabel,
  projectStatusLabel,
  projectStatusLabels,
  projectTagColors,
} from '~/features/project/types'
import type {
  ManagedProject,
  ProjectEditable,
  ProjectProgress,
  ProjectPublicationStatus,
  ProjectTag,
  ProjectLinkInput,
  ProjectLinkKind,
} from '~/features/project/types'
import type { ProjectRecovery } from '~/features/project/editor'
import { contentRelationSummary } from '~/features/content-relation/editor'
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
const projectStatuses = Object.keys(projectStatusLabels) as ProjectPublicationStatus[],
  projectLinkKinds = Object.keys(projectLinkLabels) as ProjectLinkKind[]
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
function changeTag(index: number, patch: Partial<ProjectTag>) {
  change(
    'tags',
    props.value.tags.map((tag, i) => (i === index ? { ...tag, ...patch } : { ...tag })),
  )
}
function changeLink(index: number, patch: Partial<ProjectLinkInput>) {
  change(
    'links',
    props.value.links.map((link, i) => (i === index ? { ...link, ...patch } : { ...link })),
  )
}
function addLink() {
  const kind = projectLinkKinds.find((kind) => !props.value.links.some((link) => link.kind === kind))
  if (kind) change('links', [...props.value.links, { kind, href: '' }])
}
function selectMedia(asset: MediaAsset) {
  selectedMedia.value = asset
  change('coverMediaId', asset.id)
}
</script>
<style scoped lang="scss">
.project-editor {
  display: grid;
  gap: 1rem;
  max-width: 1000px;
  overflow-wrap: anywhere;
}
header,
footer,
.project-editor__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
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
.project-editor__row > label {
  flex: 1 1 180px;
}
.project-editor__row {
  margin-block: 0.65rem;
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
.project-editor__notice {
  padding: 1rem;
  border: 1px solid var(--accent);
  border-radius: 0.5rem;
}
.project-editor__notice p {
  white-space: pre-wrap;
}
.project-editor__preview {
  max-width: 360px;
  margin-block: 0.75rem;
}
</style>
