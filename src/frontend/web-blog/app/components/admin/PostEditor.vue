<!--
  @file PostEditor.vue
  @description 文章编辑、实时字数与阅读时间估算、章节定位及预览，发布前提示缺失替代文本；保存和发布由页面处理，支持保存快捷键与图片上传
-->
<template>
  <form ref="editorForm" class="post-editor" @submit.prevent="requestSave(draft.status)">
    <AdminActionBar class="post-editor__actions" position="top">
      <AdminBackLink to="/admin/posts">{{ $t('admin-content.postEditor.backToList') }}</AdminBackLink>
      <span>{{
        $t('admin-content.postEditor.currentStatus', {
          status: $t(
            `admin-content.postStatus.${draft.status === 'published' || draft.status === 'archived' ? draft.status : 'draft'}`,
          ),
        })
      }}</span>
      <CommonTooltip :content="$t('admin-content.postEditor.saveTooltip', { shortcut: saveShortcut })">
        <button
          ref="saveButton"
          :aria-busy="pending"
          type="submit"
          :disabled="pending || imageUpload.uploading.value > 0"
          aria-keyshortcuts="Control+S Meta+S"
        >
          {{
            pending
              ? $t('admin-content.postEditor.saving')
              : draft.status === 'draft'
                ? $t('admin-content.postEditor.saveDraft')
                : $t('admin-content.postEditor.saveChanges')
          }}
        </button>
      </CommonTooltip>
      <button
        v-if="draft.status !== 'published'"
        type="button"
        :disabled="pending || imageUpload.uploading.value > 0 || !draft.title.trim() || !draft.contentRaw.trim()"
        @click="requestSave('published')"
      >
        {{ $t('admin-content.postEditor.publish') }}
      </button>
      <button v-if="draft.status === 'published'" type="button" :disabled="pending" @click="$emit('save', 'draft')">
        {{ $t('admin-content.postEditor.withdraw') }}
      </button>
      <button v-if="draft.status === 'archived'" type="button" :disabled="pending" @click="$emit('save', 'draft')">
        {{ $t('admin-content.postEditor.restore') }}
      </button>
      <NuxtLink v-if="draft.id && draft.status === 'published'" :to="articlePath({ id: draft.id, slug: draft.slug })">{{
        $t('admin-content.postEditor.viewPublic')
      }}</NuxtLink>
    </AdminActionBar>
    <p v-if="error" role="alert">{{ error }}</p>
    <label
      >{{ $t('admin-content.postEditor.title')
      }}<input v-model="draft.title" required maxlength="200" :disabled="pending"
    /></label>
    <label
      >{{ $t('admin-content.postEditor.summary')
      }}<textarea v-model="draft.summary" maxlength="1000" rows="2" :disabled="pending" />
    </label>
    <button
      type="button"
      :disabled="pending || !draft.contentRaw.trim()"
      @click="draft.summary = suggestedSummary(draft.contentRaw)"
    >
      {{ $t('admin-content.postEditor.generateSummary') }}
    </button>
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
    <div class="post-editor__fields">
      <label
        >{{ $t('admin-content.postEditor.folder')
        }}<input v-model="draft.folder" :list="folderListId" maxlength="64" required :disabled="pending"
      /></label>
      <datalist :id="folderListId"><option v-for="folder in options.folders" :key="folder" :value="folder" /></datalist>
      <label
        >{{ $t('admin-content.postEditor.category')
        }}<select v-model="draft.category" :disabled="pending">
          <option value="tech">{{ $t('admin-content.postCategory.tech') }}</option>
          <option value="life">{{ $t('admin-content.postCategory.life') }}</option>
        </select></label
      >
      <label>{{ $t('admin-content.postEditor.tags') }}<input v-model="tags" :disabled="pending" /></label>
      <label
        >{{ $t('admin-content.postEditor.readTime')
        }}<input
          v-model.number="draft.readTimeMinutes"
          type="number"
          min="1"
          max="300"
          :aria-describedby="`${readingStatsId} ${readingHintId}`"
          :disabled="pending"
      /></label>
    </div>
    <AdminPostEditorReading
      :reading-stats="readingStats"
      :reading-stats-id="readingStatsId"
      :reading-hint-id="readingHintId"
      :status="readingTimeStatus"
      :pending="pending"
      @apply="applyReadingTime"
    />
    <div
      v-if="options.tags.length"
      class="post-editor__tag-options"
      :aria-label="$t('admin-content.postEditor.existingTags')"
    >
      <span>{{ $t('admin-content.postEditor.addExistingTag') }}</span
      ><button
        v-for="tag in options.tags"
        :key="tag"
        type="button"
        :disabled="pending || selectedTags.includes(tag)"
        @click="addTag(tag)"
      >
        {{ tag }}
      </button>
    </div>
    <AdminPostEditorCover
      v-model="draft"
      v-model:cover-failed="coverFailed"
      :pending="pending"
      @pick="openMedia('cover')"
    />
    <AdminPostEditorSeo
      v-model="draft"
      :pending="pending"
      :address-preview="addressPreview"
      @normalize-slug="normalizeSlug"
    />
    <label class="post-editor__check"
      ><input v-model="draft.pinned" type="checkbox" :disabled="pending" />{{
        $t('admin-content.postEditor.pinned')
      }}</label
    >
    <button type="button" :disabled="pending" @click="openMedia('body')">
      {{ $t('admin-content.postEditor.insertMedia') }}
    </button>
    <p :id="bodyHintId" class="post-editor__hint">
      {{ $t('admin-content.postEditor.bodyHint') }}
    </p>
    <p class="post-editor__hint" role="status" :aria-label="$t('admin-content.postEditor.uploadStatusLabel')">
      {{ imageUpload.status.value }}
    </p>
    <PostOutline :headings="headings" :disabled="pending || composing" @navigate="navigateHeading" />
    <div class="post-editor__body">
      <label
        >{{ $t('admin-content.postEditor.body')
        }}<textarea
          ref="bodyInput"
          v-model="draft.contentRaw"
          rows="24"
          maxlength="200000"
          :disabled="pending"
          :aria-describedby="`${bodyHintId} ${readingStatsId}`"
          @compositionstart="composing = true"
          @compositionend="composing = false"
          @paste="imageUpload.onPaste"
          @dragover="imageUpload.onDragOver"
          @drop="imageUpload.onDrop"
        />
      </label>
      <section class="post-editor__preview" :aria-label="$t('admin-content.postEditor.previewLabel')">
        <h2>{{ $t('admin-content.postEditor.preview') }}</h2>
        <ArticleMarkdown :content="draft.contentRaw" />
      </section>
    </div>
  </form>
  <AdminPostPublishDialog
    ref="publishDialog"
    :draft="draft"
    :pending="pending"
    :address-preview="addressPreview"
    :selected-tags="selectedTags"
    :cover-failed="coverFailed"
    @close="$emit('reviewing', false)"
    @confirm="$emit('save', 'published')"
  />
  <AdminMediaPicker v-model:open="mediaOpen" @selected="selectMedia" />
</template>
<script setup lang="ts">
import type { AdminPostDraft } from '~/features/post/adminTypes'
import { postReadingStats, suggestedSummary } from '~/utils/postPublishing'
import { parsePostMarkdown } from '~/utils/postMarkdown'
import type { MediaAsset } from '~/features/media/types'
import PostOutline from './PostOutline.vue'
import { postHeadings } from '~/features/post/outline'
import type { PostHeading } from '~/features/post/outline'
import { focusTextareaHeading } from '~/utils/textareaHeadingPosition'
const { t } = useI18n()
const draft = defineModel<AdminPostDraft>({ required: true })
const tags = defineModel<string>('tags', { required: true })
const props = withDefaults(
  defineProps<{
    pending: boolean
    error: string
    options?: { folders: string[]; tags: string[] }
    /** 是否有未保存到服务器的修改；未传入时视为有修改，快捷键照常保存 */
    dirty?: boolean
  }>(),
  {
    options: () => ({ folders: [], tags: [] }),
    dirty: true,
  },
)
const folderListId = useId()
const relations = useContentRelationPicker(
  computed(() => draft.value.relatedContent ?? []),
  computed(() => (draft.value.id ? { type: 'post' as const, id: draft.value.id } : undefined)),
  computed(() => !props.pending),
  (value) => {
    draft.value.relatedContent = value
  },
)
const selectedTags = computed(() =>
  tags.value
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean),
)
function addTag(tag: string) {
  if (!selectedTags.value.includes(tag)) tags.value = [...selectedTags.value, tag].join(', ')
}
const emit = defineEmits<{ save: [status: AdminPostDraft['status']]; reviewing: [value: boolean] }>()
const editorForm = ref<HTMLFormElement | null>(null)
const bodyInput = ref<HTMLTextAreaElement | null>(null)
const saveButton = ref<HTMLButtonElement | null>(null)
const bodyHintId = useId()
const imageUpload = useAdminMarkdownImageUpload(bodyInput, { disabled: () => props.pending })
// 快捷键与“保存”按钮走同一个表单提交：已发布文章同样先打开发布前检查。
const { label: saveShortcut } = useAdminSaveShortcut({
  form: editorForm,
  submitter: () => saveButton.value,
  dirty: () => props.dirty,
  enabled: () => !mediaOpen.value,
})
const composing = ref(false)
// textarea 的原生值将 CRLF 规范为 LF；只为定位计算转换，不回写存储的正文。
const normalizedContent = computed(() => draft.value.contentRaw.replace(/\r\n?/g, '\n'))
// 章节与统计复用一次完整解析，避免长文每次输入额外解析一遍 Markdown。
const markdownTokens = computed(() => parsePostMarkdown(normalizedContent.value))
const headings = computed(() => postHeadings(normalizedContent.value, markdownTokens.value))
function navigateHeading(heading: PostHeading) {
  if (props.pending || composing.value || !bodyInput.value) return
  focusTextareaHeading(bodyInput.value, heading.offset)
}
const mediaOpen = ref(false)
const mediaTarget = ref<'cover' | 'body'>('cover')
watch(mediaOpen, (value) => emit('reviewing', value))
function openMedia(target: 'cover' | 'body') {
  mediaTarget.value = target
  mediaOpen.value = true
}
function selectMedia(asset: MediaAsset) {
  if (mediaTarget.value === 'cover') {
    draft.value.cover = asset.url
    draft.value.coverAlt = asset.alt
    return
  }
  const text = draft.value.contentRaw
  const start = bodyInput.value?.selectionStart ?? text.length
  const end = bodyInput.value?.selectionEnd ?? start
  const alt = (asset.alt || asset.name).replace(/[[\]\\]/g, '\\$&').replace(/\r?\n/g, ' ')
  draft.value.contentRaw = `${text.slice(0, start)}\n![${alt}](${asset.url})\n${text.slice(end)}`
}
const publishDialog = ref<{ showModal: () => void } | null>(null)
const coverFailed = ref(false)
watch(
  () => draft.value.cover,
  () => {
    coverFailed.value = false
  },
)
const readingStatsId = useId()
const readingHintId = useId()
// 统计仅派生自正文，不写入草稿；载入、恢复与继续编辑都保留已有阅读分钟。
const readingStats = computed(() => postReadingStats(normalizedContent.value, markdownTokens.value))
const readingTimeStatus = ref('')
function applyReadingTime() {
  if (props.pending || !readingStats.value.wordCount) return
  draft.value.readTimeMinutes = readingStats.value.minutes
  readingTimeStatus.value = t('admin-content.postEditor.readingApplied', { minutes: readingStats.value.minutes })
}
const siteUrl = String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')
const addressPreview = computed(
  () => `${siteUrl}/articles/${draft.value.slug || draft.value.id || t('admin-content.postEditor.addressPending')}`,
)
function normalizeSlug() {
  draft.value.slug = (draft.value.slug ?? '').trim().toLowerCase()
}
function requestSave(status: AdminPostDraft['status']) {
  if (props.pending) return
  normalizeSlug()
  if (!editorForm.value?.reportValidity()) return
  if (status === 'published') {
    if (!draft.value.title.trim() || !draft.value.contentRaw.trim()) return
    emit('reviewing', true)
    publishDialog.value?.showModal()
  } else emit('save', status)
}
</script>
<style scoped lang="scss">
@use '~/assets/styles/post-editor' as post;

@include post.editor;
</style>
