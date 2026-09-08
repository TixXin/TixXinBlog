<!--
  @file FlashEditor.vue
  @description Blinko 风格闪念编辑器：textarea + 顶部 mood 切换 + 底部工具栏（格式占位 / 标签 / 发布）
  @author TixXin
  @since 2026-04-11
-->

<template>
  <div class="fed" :class="{ 'fed--compact': !expanded, 'fed--focused': focused }">
    <fieldset class="fed__fieldset" :disabled="submitting">
      <p v-if="validationError" role="alert">{{ validationError }}</p>
      <!-- 顶部条：mood 切换（占位） + 字数；紧凑态隐藏 -->
      <header v-show="expanded" class="fed__header">
        <div class="fed__moods" role="group" aria-label="闪念类型">
          <button
            v-for="m in moods"
            :key="m.id"
            type="button"
            class="fed__mood"
            :class="{ 'fed__mood--active': mood === m.id }"
            :aria-pressed="mood === m.id"
            @click="mood = m.id"
          >
            <Icon :name="m.icon" size="13" />
            {{ m.label }}
          </button>
        </div>
        <span class="fed__count" :class="{ 'fed__count--warn': content.length > maxLength * 0.9 }">
          {{ content.length }} / {{ maxLength }}
        </span>
      </header>

      <!-- 主输入区：textarea + 右上角展开/收起按钮 -->
      <div class="fed__editor-wrap">
        <textarea
          ref="textareaRef"
          v-model="content"
          class="fed__textarea"
          :placeholder="placeholder"
          :rows="expanded ? 4 : 1"
          :maxlength="maxLength"
          aria-label="闪念正文"
          @focus="focused = true"
          @blur="focused = false"
          @keydown="onEditorKeydown"
        />
        <button
          type="button"
          class="fed__expand-toggle"
          :aria-label="expanded ? '收起编辑器' : '展开编辑器'"
          :title="expanded ? '收起编辑器' : '展开编辑器'"
          @click="toggleExpand"
        >
          <Icon :name="expanded ? 'lucide:minimize-2' : 'lucide:maximize-2'" size="12" />
        </button>
      </div>

      <!-- 标签 chips -->
      <div v-if="tags.length > 0 || tagDraft" class="fed__tags">
        <span v-for="t in tags" :key="t" class="fed__tag">
          #{{ t }}
          <button type="button" class="fed__tag-remove" aria-label="移除标签" @click="removeTag(t)">
            <Icon name="lucide:x" size="10" />
          </button>
        </span>
      </div>

      <button
        type="button"
        class="fed__tool fed__tool--text"
        :disabled="submitting || images.length >= 9"
        @click="mediaOpen = true"
      >
        <Icon name="lucide:images" size="14" />从媒体库选择图片
      </button>
      <!-- 图片 URL 列表（折叠态，paperclip 触发） -->
      <div v-if="showImageInput" class="fed__images">
        <label class="fed__images-label" :for="imageInputId">
          <Icon name="lucide:image" size="12" />
          <span>图片 URL（每行一个，最多 9 张）</span>
        </label>
        <textarea
          :id="imageInputId"
          v-model="imageInput"
          rows="3"
          class="fed__images-input"
          placeholder="https://example.com/photo.jpg"
          @blur="commitImages"
        />
        <div v-if="images.length > 0" class="fed__images-thumbs">
          <span v-for="(img, idx) in images" :key="img + idx" class="fed__images-thumb">
            <img :src="img" alt="" />
          </span>
        </div>
      </div>

      <!-- 底部工具栏 -->
      <footer class="fed__footer">
        <div class="fed__tools">
          <button type="button" class="fed__tool" aria-label="加粗" @click="insertWrap('**', '**')">
            <Icon name="lucide:bold" size="14" />
          </button>
          <button type="button" class="fed__tool" aria-label="斜体" @click="insertWrap('*', '*')">
            <Icon name="lucide:italic" size="14" />
          </button>
          <button type="button" class="fed__tool" aria-label="列表" @click="insertPrefix('- ')">
            <Icon name="lucide:list" size="14" />
          </button>
          <button type="button" class="fed__tool" aria-label="待办" @click="insertPrefix('- [ ] ')">
            <Icon name="lucide:check-square" size="14" />
          </button>
          <button type="button" class="fed__tool" aria-label="引用" @click="insertPrefix('> ')">
            <Icon name="lucide:quote" size="14" />
          </button>
          <button type="button" class="fed__tool" aria-label="代码" @click="insertWrap('`', '`')">
            <Icon name="lucide:code" size="14" />
          </button>
          <span class="fed__tool-divider" aria-hidden="true" />
          <button type="button" class="fed__tool" aria-label="添加标签" @click="onTagButtonClick">
            <Icon name="lucide:hash" size="14" />
          </button>
          <button
            type="button"
            class="fed__tool"
            :class="{ 'fed__tool--active': showImageInput || images.length > 0 }"
            :aria-label="`图片（已添加 ${images.length}）`"
            :title="`图片 URL 列表（已添加 ${images.length}/9）`"
            @click="onImageButtonClick"
          >
            <Icon name="lucide:paperclip" size="14" />
            <span v-if="images.length > 0" class="fed__tool-count">{{ images.length }}</span>
          </button>
          <button type="button" class="fed__tool" aria-label="表情（开发中）" title="表情功能开发中" disabled>
            <Icon name="lucide:smile" size="14" />
          </button>
        </div>

        <div class="fed__publish">
          <input
            v-show="showTagInput"
            ref="tagInputRef"
            v-model="tagDraft"
            type="text"
            aria-label="新标签"
            class="fed__tag-input"
            placeholder="新标签 ↵"
            maxlength="20"
            @keydown.enter.prevent="commitTag"
            @keydown.,.prevent="commitTag"
            @keydown.space.prevent="commitTag"
            @blur="onTagInputBlur"
          />
          <button type="button" class="fed__tool fed__tool--text" :disabled="!canSubmit" @click="submit(true)">
            保存草稿
          </button>
          <button
            type="button"
            class="fed__submit"
            aria-label="发布闪念"
            aria-keyshortcuts="Control+Enter Meta+Enter"
            :disabled="!canSubmit"
            @click="submit(false)"
          >
            <Icon name="lucide:send-horizontal" size="13" />
            <span>发布</span>
            <kbd class="fed__kbd" aria-hidden="true">Ctrl/⌘↵</kbd>
          </button>
        </div>
      </footer>
    </fieldset>
  </div>
  <AdminMediaPicker v-model:open="mediaOpen" @selected="selectMedia" />
</template>

<script setup lang="ts">
import type { FlashNoteDraft, FlashType } from '~/features/flash/types'
import type { MediaAsset } from '~/features/media/types'
const props = withDefaults(
  defineProps<{ submitting?: boolean; initial?: FlashNoteDraft | null; maxLength?: number }>(),
  { maxLength: 500, initial: null, submitting: false },
)

const emit = defineEmits<{
  submit: [draft: FlashNoteDraft]
  dirty: [dirty: boolean]
}>()

// MoodId 与 FlashType 一致，避免转换层；后续两者同步演进
type MoodId = FlashType
const moods: { id: MoodId; icon: string; label: string }[] = [
  { id: 'idea', icon: 'lucide:lightbulb', label: '灵感' },
  { id: 'todo', icon: 'lucide:check-circle', label: '待办' },
  { id: 'memo', icon: 'lucide:file-text', label: '随记' },
]

const placeholderByMood: Record<MoodId, string> = {
  idea: '此刻闪过的灵感是…',
  todo: '想要去做的事是…',
  memo: '随手记下…',
}

const content = ref(props.initial?.content ?? '')
const validationError = ref('')
const tags = ref<string[]>([...(props.initial?.tags ?? [])])
const tagDraft = ref('')
const focused = ref(false)
const mood = ref<MoodId>(props.initial?.type ?? 'idea')
const showTagInput = ref(false)
const showImageInput = ref(false)
const imageInput = ref('')
const images = ref<string[]>([...(props.initial?.images ?? [])])
const mediaOpen = ref(false)
const imageInputId = useId()
function onEditorKeydown(event: KeyboardEvent) {
  if (!event.isComposing && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    submit(false)
  }
}
function selectMedia(asset: MediaAsset) {
  if (images.value.length >= 9 && !images.value.includes(asset.url)) {
    validationError.value = '最多 9 张图片'
    return
  }
  if (!images.value.includes(asset.url)) images.value.push(asset.url)
  imageInput.value = images.value.join('\n')
  showImageInput.value = true
}
// 紧凑态默认收起 mood/字数/大 textarea；聚焦或有输入时自动展开
const expanded = ref(false)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const tagInputRef = ref<HTMLInputElement | null>(null)

const placeholder = computed(() => placeholderByMood[mood.value])
const canSubmit = computed(
  () => content.value.trim().length > 0 && content.value.length <= props.maxLength && !props.submitting,
)

watch([focused, () => content.value.length > 0, () => tags.value.length > 0], ([f, hasContent, hasTags]) => {
  if (f || hasContent || hasTags) expanded.value = true
})

function toggleExpand() {
  expanded.value = !expanded.value
  if (expanded.value) {
    void nextTick(() => textareaRef.value?.focus())
  }
}

function commitTag() {
  const t = tagDraft.value.trim().replace(/^#/, '')
  if (!t) return true
  if (t.length > 64 || (tags.value.length >= 20 && !tags.value.includes(t))) {
    validationError.value = '最多 20 个标签，每个标签不超过 64 字'
    return false
  }
  if (!tags.value.includes(t)) {
    tags.value.push(t)
  }
  tagDraft.value = ''
  validationError.value = ''
  return true
}

function removeTag(t: string) {
  tags.value = tags.value.filter((x) => x !== t)
}

function onTagButtonClick() {
  showTagInput.value = true
  void nextTick(() => tagInputRef.value?.focus())
}

function onTagInputBlur() {
  if (tagDraft.value.trim() && !commitTag()) return
  showTagInput.value = false
}

function onImageButtonClick() {
  if (showImageInput.value && !commitImages()) return
  showImageInput.value = !showImageInput.value
  if (showImageInput.value && images.value.length > 0 && !imageInput.value) {
    imageInput.value = images.value.join('\n')
  }
}

/** 图片地址必须与真实接口一致，校验失败时保留输入，不静默截断。 */
function commitImages() {
  const list = imageInput.value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  const unique = Array.from(new Set(list))
  if (
    unique.length > 9 ||
    unique.some((value) => {
      try {
        if (/^\/api\/v1\/media\/[0-9a-f-]{36}\.webp$/.test(value)) return false
        const url = new URL(value)
        return !['http:', 'https:'].includes(url.protocol) || !!url.username || !!url.password
      } catch {
        return true
      }
    })
  ) {
    validationError.value = '最多 9 张图片，请填写完整 HTTP(S) 地址，不能包含账号密码'
    return false
  }
  images.value = unique
  validationError.value = ''
  return true
}

/** 在 textarea 选区两侧插入包裹符号（如 **bold**） */
function insertWrap(left: string, right: string) {
  const el = textareaRef.value
  if (!el) return
  const start = el.selectionStart ?? 0
  const end = el.selectionEnd ?? 0
  const before = content.value.slice(0, start)
  const sel = content.value.slice(start, end)
  const after = content.value.slice(end)
  content.value = `${before}${left}${sel || '文字'}${right}${after}`
  void nextTick(() => {
    el.focus()
    const cursor = before.length + left.length + (sel || '文字').length
    el.setSelectionRange(cursor, cursor)
  })
}

/** 在当前行行首插入前缀（如 "- " 或 "> "） */
function insertPrefix(prefix: string) {
  const el = textareaRef.value
  if (!el) return
  const start = el.selectionStart ?? 0
  const before = content.value.slice(0, start)
  const after = content.value.slice(start)
  // 找到当前行行首
  const lineStart = before.lastIndexOf('\n') + 1
  content.value = `${before.slice(0, lineStart)}${prefix}${before.slice(lineStart)}${after}`
  void nextTick(() => {
    el.focus()
    const cursor = start + prefix.length
    el.setSelectionRange(cursor, cursor)
  })
}

function submit(asDraft = false) {
  if (!canSubmit.value) return
  if (tagDraft.value.trim() && !commitTag()) return
  if (showImageInput.value && !commitImages()) return
  emit('submit', {
    content: content.value.trim(),
    isDraft: asDraft,
    tags: [...tags.value],
    type: mood.value,
    images: images.value.length > 0 ? [...images.value] : undefined,
  })
  // 只有父页面确认写入成功后才通过 key 重建并清空编辑器。
}
const initialState = JSON.stringify([content.value, tags.value, images.value, mood.value])
watch(
  [content, tags, images, mood, tagDraft, imageInput],
  () =>
    emit(
      'dirty',
      !!tagDraft.value.trim() ||
        (showImageInput.value && imageInput.value.trim() !== images.value.join('\n')) ||
        JSON.stringify([content.value, tags.value, images.value, mood.value]) !== initialState,
    ),
  { deep: true },
)
defineExpose({ focus: () => textareaRef.value?.focus() })
</script>

<style lang="scss" scoped>
.fed__fieldset {
  display: contents;
}
.fed {
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &--focused {
    border-color: var(--accent);
    box-shadow:
      var(--shadow-card),
      0 0 0 3px var(--accent-soft);
  }
}

.fed__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.625rem 0.875rem 0.5rem;
}

.fed__moods {
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  background: var(--surface-2);
  border-radius: $radius-full;
  padding: 0.1875rem;
}

.fed__mood {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.625rem;
  border: none;
  border-radius: $radius-full;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--accent-text);
  }

  &--active {
    background: var(--surface-1);
    color: var(--accent-text);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }
}

.fed__count {
  font-size: 0.6875rem;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;

  &--warn {
    color: var(--danger);
  }
}

.fed__editor-wrap {
  position: relative;
}

.fed__textarea {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-main);
  font-size: 0.9375rem;
  line-height: 1.7;
  resize: vertical;
  font-family: inherit;
  min-height: 5.5rem;
  padding: 0.25rem 2.25rem 0.5rem 1rem;

  &::placeholder {
    color: var(--text-faint);
  }
}

/* 右上角展开/收起按钮，照抄留言板 MessageInput 同款 */
.fed__expand-toggle {
  position: absolute;
  top: 0.375rem;
  right: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  padding: 0;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: var(--text-faint);
  cursor: pointer;
  transition:
    color 0.18s,
    background 0.18s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--text-soft);
    background: var(--surface-2);
  }
}

/* ---- 紧凑态：贴近留言板底部输入框的简约样式 ---- */
.fed--compact {
  .fed__textarea {
    min-height: 2.75rem;
    line-height: 1.5;
    padding: 0.625rem 2.25rem 0.5rem 1rem;
    resize: none;
  }

  .fed__footer {
    border-top: none;
    padding-top: 0.375rem;
  }
}

.fed__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  padding: 0 1rem 0.5rem;
}

.fed__tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.1875rem 0.5rem 0.1875rem 0.625rem;
  border-radius: $radius-full;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 0.6875rem;
  font-weight: 600;
}

.fed__tag-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  border: none;
  background: transparent;
  color: var(--accent-text);
  cursor: pointer;
  border-radius: $radius-full;
  padding: 0;

  &:hover {
    background: rgba(0, 0, 0, 0.06);
  }
}

.fed__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0.625rem 0.5rem 0.75rem;
  border-top: 1px dashed var(--border-soft);
}

.fed__tools {
  min-width: 0;
  flex: 1 1 16rem;
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  flex-wrap: wrap;
}

.fed__tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--text-soft);
  cursor: pointer;
  border-radius: $radius-sm;
  transition:
    color 0.18s,
    background 0.18s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--accent-text);
    background: var(--accent-soft);
  }
}

.fed__tool-divider {
  display: inline-block;
  width: 1px;
  height: 16px;
  background: var(--border-soft);
  margin: 0 0.25rem;
}

.fed__tool--active {
  color: var(--accent-text);
  background: var(--accent-soft);
}
.fed__tool--text {
  width: auto;
  min-height: 40px;
  padding: 0.375rem 0.75rem;
  white-space: nowrap;
  gap: 0.375rem;
}
@media (pointer: coarse) {
  .fed__tool {
    min-width: 44px;
    min-height: 44px;
  }
}

.fed__tool-count {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  font-size: 0.5625rem;
  line-height: 14px;
  text-align: center;
  color: #fff;
  background: var(--accent);
  border-radius: $radius-full;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* paperclip 按钮需要 relative 来定位计数徽章 */
.fed__tool {
  position: relative;
}

/* ---- 图片 URL 输入区 ---- */
.fed__images {
  margin: 0.5rem 0;
  padding: 0.625rem 0.75rem;
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  border-radius: $radius-sm;
}

.fed__images-label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--text-soft);
  margin-bottom: 0.375rem;
}

.fed__images-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-soft);
  border-radius: $radius-sm;
  background: var(--surface-1);
  color: var(--text-main);
  font-size: 0.75rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  outline: none;
  resize: vertical;

  &:focus {
    border-color: var(--accent);
  }
}

.fed__images-thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.5rem;
}

.fed__images-thumb {
  width: 36px;
  height: 36px;
  border-radius: $radius-sm;
  overflow: hidden;
  background: var(--surface-3);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.fed__publish {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  margin-left: auto;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
}

.fed__tag-input {
  min-height: 40px;
  max-width: 100%;
  width: 7rem;
  padding: 0.3125rem 0.625rem;
  border: 1px solid var(--border-soft);
  border-radius: $radius-full;
  background: var(--surface-2);
  color: var(--text-main);
  font-size: 0.6875rem;
  outline: none;

  &:focus {
    border-color: var(--accent);
    background: var(--surface-1);
  }

  &::placeholder {
    color: var(--text-faint);
  }
}

.fed__submit {
  min-height: 40px;
  white-space: nowrap;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4375rem 0.875rem;
  border: none;
  border-radius: $radius-full;
  background: var(--accent-action);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
}

.fed__kbd {
  font-size: 0.625rem;
  padding: 0.0625rem 0.375rem;
  border-radius: $radius-sm;
  background: rgba(255, 255, 255, 0.18);
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  letter-spacing: 0.04em;
}
</style>
