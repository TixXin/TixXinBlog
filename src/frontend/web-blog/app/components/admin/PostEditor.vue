<!--
  @file PostEditor.vue
  @description 文章编辑、实时字数与阅读时间估算、章节定位及预览，发布前提示缺失替代文本；保存和发布由页面处理，支持保存快捷键与图片上传
-->
<template>
  <form ref="editorForm" class="post-editor" @submit.prevent="requestSave(draft.status)">
    <AdminActionBar class="post-editor__actions" position="top">
      <AdminBackLink to="/admin/posts">返回文章列表</AdminBackLink>
      <span
        >当前状态：{{ draft.status === 'published' ? '已发布' : draft.status === 'archived' ? '已归档' : '草稿' }}</span
      >
      <CommonTooltip :content="`保存（${saveShortcut}）`">
        <button
          ref="saveButton"
          :aria-busy="pending"
          type="submit"
          :disabled="pending || imageUpload.uploading.value > 0"
          aria-keyshortcuts="Control+S Meta+S"
        >
          {{ pending ? '保存中…' : draft.status === 'draft' ? '保存草稿' : '保存修改' }}
        </button>
      </CommonTooltip>
      <button
        v-if="draft.status !== 'published'"
        type="button"
        :disabled="pending || imageUpload.uploading.value > 0 || !draft.title.trim() || !draft.contentRaw.trim()"
        @click="requestSave('published')"
      >
        发布文章
      </button>
      <button v-if="draft.status === 'published'" type="button" :disabled="pending" @click="$emit('save', 'draft')">
        撤回为草稿
      </button>
      <button v-if="draft.status === 'archived'" type="button" :disabled="pending" @click="$emit('save', 'draft')">
        恢复为草稿
      </button>
      <NuxtLink v-if="draft.id && draft.status === 'published'" :to="articlePath({ id: draft.id, slug: draft.slug })"
        >查看公开文章</NuxtLink
      >
    </AdminActionBar>
    <p v-if="error" role="alert">{{ error }}</p>
    <label>标题<input v-model="draft.title" required maxlength="200" :disabled="pending" /></label>
    <label>摘要<textarea v-model="draft.summary" maxlength="1000" rows="2" :disabled="pending" /></label>
    <button
      type="button"
      :disabled="pending || !draft.contentRaw.trim()"
      @click="draft.summary = suggestedSummary(draft.contentRaw)"
    >
      从正文生成摘要
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
        >专栏<input v-model="draft.folder" :list="folderListId" maxlength="64" required :disabled="pending"
      /></label>
      <datalist :id="folderListId"><option v-for="folder in options.folders" :key="folder" :value="folder" /></datalist>
      <label
        >类别<select v-model="draft.category" :disabled="pending">
          <option value="tech">技术</option>
          <option value="life">生活</option>
        </select></label
      >
      <label>标签（逗号分隔）<input v-model="tags" :disabled="pending" /></label>
      <label
        >阅读分钟<input
          v-model.number="draft.readTimeMinutes"
          type="number"
          min="1"
          max="300"
          :aria-describedby="`${readingStatsId} ${readingHintId}`"
          :disabled="pending"
      /></label>
    </div>
    <div class="post-editor__reading">
      <p :id="readingStatsId" data-post-reading-stats>
        正文字数：{{ readingStats.wordCount.toLocaleString('zh-CN') }}（中文
        {{ readingStats.chineseCharacters.toLocaleString('zh-CN') }} 字，英文及数字
        {{ readingStats.words.toLocaleString('zh-CN') }} 词） · 建议阅读时间约 {{ readingStats.minutes }} 分钟
      </p>
      <CommonTooltip content="按当前正文字数填入阅读分钟，之后仍可手动修改">
        <button
          type="button"
          data-post-apply-reading-time
          :aria-describedby="`${readingStatsId} ${readingHintId}`"
          :disabled="pending || !readingStats.wordCount"
          @click="applyReadingTime"
        >
          按字数估算阅读时长
        </button>
      </CommonTooltip>
      <p :id="readingHintId" class="post-editor__hint">
        中文按字、英文及数字按词计数，不计代码块和图片。按中文约 350 字/分钟、英文及数字约 220
        词/分钟估算；仅点击按钮时填入阅读分钟，可继续手动修改。
      </p>
      <p class="post-editor__hint" role="status" aria-label="阅读时长填入状态">{{ readingTimeStatus }}</p>
    </div>
    <div v-if="options.tags.length" class="post-editor__tag-options" aria-label="已有标签">
      <span>添加已有标签：</span
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
    <label
      >封面地址<input v-model="draft.cover" maxlength="2048" :disabled="pending" placeholder="https:// 或站内图片路径"
    /></label>
    <label
      >封面替代文本<input v-model="draft.coverAlt" maxlength="300" :disabled="pending" placeholder="简要描述图片内容"
    /></label>
    <button type="button" :disabled="pending" @click="openMedia('cover')">从媒体库选择封面</button>
    <div v-if="draft.cover" class="post-editor__cover-preview">
      <img v-if="!coverFailed" :src="draft.cover" :alt="draft.coverAlt || '文章封面预览'" @error="coverFailed = true" />
      <p v-else role="status">
        封面预览加载失败，请检查地址或稍后重试。<button type="button" @click="coverFailed = false">重试封面预览</button>
      </p>
    </div>
    <section class="post-editor__seo" aria-label="文章地址与 SEO">
      <h2>文章地址与 SEO</h2>
      <label
        >文章地址标识<input
          v-model="draft.slug"
          maxlength="120"
          pattern="[a-z][a-z0-9]*(-[a-z0-9]+)*"
          :disabled="pending"
          placeholder="例如 vue-reactivity，留空使用数字地址"
          @blur="normalizeSlug"
      /></label>
      <p>以小写字母开头，只使用小写字母、数字和连字符。修改后旧地址仍指向本文。</p>
      <label
        >SEO 标题<input v-model="draft.seoTitle" maxlength="160" :disabled="pending" placeholder="留空使用文章标题"
      /></label>
      <label
        >SEO 描述<textarea
          v-model="draft.seoDescription"
          maxlength="320"
          rows="3"
          :disabled="pending"
          placeholder="留空使用文章摘要或正文摘要"
        />
      </label>
      <label class="post-editor__check"
        ><input
          v-model="draft.seoNoindex"
          type="checkbox"
          :disabled="pending"
        />不让搜索引擎收录（文章仍公开可访问）</label
      >
      <div class="post-editor__search-preview" aria-label="搜索结果预览">
        <strong>{{ draft.seoTitle || draft.title || '文章标题' }}</strong>
        <p>{{ addressPreview }}</p>
        <p>{{ draft.seoDescription || draft.summary || suggestedSummary(draft.contentRaw) || '文章描述' }}</p>
      </div>
    </section>
    <label class="post-editor__check"><input v-model="draft.pinned" type="checkbox" :disabled="pending" />置顶</label>
    <button type="button" :disabled="pending" @click="openMedia('body')">向正文插入媒体图片</button>
    <p :id="bodyHintId" class="post-editor__hint">
      可直接粘贴或拖入 JPEG、PNG、WebP 图片（单张不超过 8MB），将上传到媒体库并插入正文。
    </p>
    <p class="post-editor__hint" role="status" aria-label="正文图片上传状态">{{ imageUpload.status.value }}</p>
    <PostOutline :headings="headings" :disabled="pending || composing" @navigate="navigateHeading" />
    <div class="post-editor__body">
      <label
        >Markdown 正文<textarea
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
      <section class="post-editor__preview" aria-label="文章预览">
        <h2>预览</h2>
        <ArticleMarkdown :content="draft.contentRaw" />
      </section>
    </div>
  </form>
  <dialog
    ref="publishDialog"
    class="post-editor__publish"
    aria-labelledby="publish-check-title"
    :aria-describedby="hasMissingAlt ? 'publish-alt-description' : undefined"
    @close="$emit('reviewing', false)"
  >
    <h2 id="publish-check-title">发布前检查</h2>
    <p>{{ draft.status === 'published' ? '确认后将更新当前公开文章。' : '确认后文章将公开，访客可以阅读和互动。' }}</p>
    <dl>
      <dt>标题</dt>
      <dd>{{ draft.title }}</dd>
      <dt>文章地址</dt>
      <dd>{{ addressPreview }}</dd>
      <dt>专栏与标签</dt>
      <dd>{{ draft.folder }} · {{ selectedTags.join('、') || '无标签' }}</dd>
      <dt>搜索收录</dt>
      <dd>{{ draft.seoNoindex ? '不收录，但仍公开可访问' : '允许收录，并进入站点地图' }}</dd>
      <dt>有序关联</dt>
      <dd>{{ contentRelationSummary(draft.relatedContent) }}</dd>
      <dt>摘要</dt>
      <dd>{{ draft.seoDescription || draft.summary || suggestedSummary(draft.contentRaw) }}</dd>
    </dl>
    <p v-if="!draft.cover">未设置封面，将以无封面样式展示。</p>
    <p v-if="coverFailed">封面预览失败，确认地址正确后再发布。</p>
    <section v-if="hasMissingAlt" class="post-editor__alt-warnings" aria-labelledby="publish-alt-title">
      <h3 id="publish-alt-title">替代文本警告</h3>
      <p id="publish-alt-description">以下图片缺少替代文本，读屏用户可能无法理解图片内容。可返回补充，也可仍然发布。</p>
      <ul>
        <li v-if="missingCoverAlt">封面缺少替代文本，请填写“封面替代文本”。</li>
        <li v-for="image in missingImageAlts" :key="image.imageNumber">
          正文第 {{ image.imageNumber }} 张图片（第 {{ image.line }} 行）缺少替代文本。
        </li>
      </ul>
    </section>
    <p>地址唯一性会在保存时再次校验；保存失败不会清空输入。</p>
    <button type="button" :disabled="pending" @click="publishDialog?.close()">返回编辑</button
    ><button type="button" :disabled="pending" @click="confirmPublish">
      {{ hasMissingAlt ? '仍然公开发布' : '确认公开发布' }}
    </button>
  </dialog>
  <AdminMediaPicker v-model:open="mediaOpen" @selected="selectMedia" />
</template>
<script setup lang="ts">
import type { AdminPostDraft } from '~/features/post/adminTypes'
import { contentRelationSummary } from '~/features/content-relation/editor'
import { missingImageAltPositions, postReadingStats, suggestedSummary } from '~/utils/postPublishing'
import { parsePostMarkdown } from '~/utils/postMarkdown'
import type { MediaAsset } from '~/features/media/types'
import PostOutline from './PostOutline.vue'
import { postHeadings } from '~/features/post/outline'
import type { PostHeading } from '~/features/post/outline'
import { focusTextareaHeading } from '~/utils/textareaHeadingPosition'
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
const publishDialog = ref<HTMLDialogElement | null>(null)
const missingImageAlts = computed(() => missingImageAltPositions(draft.value.contentRaw))
const missingCoverAlt = computed(() => Boolean(draft.value.cover.trim() && !draft.value.coverAlt?.trim()))
const hasMissingAlt = computed(() => missingCoverAlt.value || missingImageAlts.value.length > 0)
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
  readingTimeStatus.value = `已填入 ${readingStats.value.minutes} 分钟，可继续手动修改。`
}
const siteUrl = String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')
const addressPreview = computed(
  () => `${siteUrl}/articles/${draft.value.slug || draft.value.id || '保存后分配文章编号'}`,
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
function confirmPublish() {
  if (props.pending || !publishDialog.value?.open) return
  publishDialog.value.close()
  emit('save', 'published')
}
</script>
<style scoped lang="scss">
.post-editor {
  display: grid;
  gap: 1rem;
}
.post-editor__cover-preview img {
  max-width: 100%;
  max-height: 240px;
  object-fit: contain;
  border-radius: 0.75rem;
}
.post-editor__seo {
  display: grid;
  gap: 0.8rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
}
.post-editor__search-preview {
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  overflow-wrap: anywhere;
}
.post-editor__search-preview strong {
  color: var(--accent);
}
.post-editor__search-preview p {
  margin: 0.4rem 0;
  color: var(--text-muted);
}
.post-editor__publish {
  max-width: min(640px, calc(100vw - 2rem));
  max-height: 85dvh;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 1rem;
  padding: 1.5rem;
  color: var(--text-main);
  background: var(--surface-1);
}
.post-editor__publish::backdrop {
  background: rgba(0, 0, 0, 0.6);
}
.post-editor__publish h2 {
  font-size: 1.3rem;
  font-weight: 700;
}
.post-editor__publish p {
  margin: 0.75rem 0;
}
.post-editor__publish dd {
  margin: 0.25rem 0 1rem;
  overflow-wrap: anywhere;
  color: var(--text-muted);
}
.post-editor__publish button {
  padding: 0.7rem;
  margin: 0.5rem 0.5rem 0 0;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--text-main);
  background: var(--surface-2);
}
.post-editor__alt-warnings {
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--surface-2);
}
.post-editor__alt-warnings h3 {
  font-weight: 700;
}
.post-editor__alt-warnings ul {
  padding-inline-start: 1.25rem;
  list-style: disc;
}
.post-editor__alt-warnings li + li {
  margin-top: 0.5rem;
}
.post-editor__tag-options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}
.post-editor__tag-options button {
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.35rem 0.6rem;
  color: var(--text-main);
  background: var(--surface-2);
}
.post-editor__tag-options button:disabled {
  opacity: 0.45;
}
.post-editor label {
  display: grid;
  gap: 0.4rem;
  color: var(--text-muted);
}
.post-editor input,
.post-editor textarea,
.post-editor select {
  min-width: 0;
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.6rem;
  background: var(--surface-2);
  color: var(--text-main);
}
.post-editor__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.post-editor__actions a {
  color: var(--accent);
}
.post-editor button {
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.55rem 0.85rem;
  background: var(--accent);
  color: white;
  cursor: var(--interaction-cursor, pointer);
}
.post-editor button:disabled {
  opacity: 0.5;
}
.post-editor__hint {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.875rem;
}
.post-editor__reading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
}
.post-editor__reading p {
  margin: 0;
}
.post-editor__reading .post-editor__hint {
  flex-basis: 100%;
}
.post-editor__fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}
.post-editor__body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  // 长文预览不能把正文输入框拉伸为整篇文章高度，否则章节选区没有独立滚动空间。
  align-items: start;
  gap: 1.5rem;
}
.post-editor__body > * {
  min-width: 0;
}
.post-editor__preview {
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1rem;
}
.post-editor .post-editor__check {
  display: flex;
  align-items: center;
}
.post-editor__check input {
  width: auto;
}
@media (max-width: 800px) {
  .post-editor__body {
    grid-template-columns: 1fr;
  }
}
</style>
