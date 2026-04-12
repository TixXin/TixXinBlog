<!--
  @file FlashEditor.vue
  @description Blinko 风格闪念编辑器：textarea + 顶部 mood 切换 + 底部工具栏（格式占位 / 标签 / 发布）
  @author TixXin
  @since 2026-04-11
-->

<template>
  <div class="fed" :class="{ 'fed--focused': focused }">
    <!-- 顶部条：mood 切换（占位） + 字数 -->
    <header class="fed__header">
      <div class="fed__moods" role="tablist" aria-label="灵感分组">
        <button
          v-for="m in moods"
          :key="m.id"
          type="button"
          class="fed__mood"
          :class="{ 'fed__mood--active': mood === m.id }"
          :aria-pressed="mood === m.id"
          role="tab"
          @click="mood = m.id"
        >
          <Icon :name="m.icon" size="13" />
          {{ m.label }}
        </button>
      </div>
      <span class="fed__count" :class="{ 'fed__count--warn': content.length > 450 }">
        {{ content.length }} / 500
      </span>
    </header>

    <!-- 主输入区 -->
    <textarea
      ref="textareaRef"
      v-model="content"
      class="fed__textarea"
      :placeholder="placeholder"
      rows="4"
      maxlength="500"
      @focus="focused = true"
      @blur="focused = false"
      @keydown.ctrl.enter="submit"
      @keydown.meta.enter="submit"
    />

    <!-- 标签 chips -->
    <div v-if="tags.length > 0 || tagDraft" class="fed__tags">
      <span v-for="t in tags" :key="t" class="fed__tag">
        #{{ t }}
        <button
          type="button"
          class="fed__tag-remove"
          aria-label="移除标签"
          @click="removeTag(t)"
        >
          <Icon name="lucide:x" size="10" />
        </button>
      </span>
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
        <button
          type="button"
          class="fed__tool"
          aria-label="添加标签"
          @click="onTagButtonClick"
        >
          <Icon name="lucide:hash" size="14" />
        </button>
        <button
          type="button"
          class="fed__tool"
          aria-label="附件（开发中）"
          title="附件功能开发中"
        >
          <Icon name="lucide:paperclip" size="14" />
        </button>
        <button
          type="button"
          class="fed__tool"
          aria-label="表情（开发中）"
          title="表情功能开发中"
        >
          <Icon name="lucide:smile" size="14" />
        </button>
      </div>

      <div class="fed__publish">
        <input
          v-show="showTagInput"
          ref="tagInputRef"
          v-model="tagDraft"
          type="text"
          class="fed__tag-input"
          placeholder="新标签 ↵"
          maxlength="20"
          @keydown.enter.prevent="commitTag"
          @keydown.,.prevent="commitTag"
          @keydown.space.prevent="commitTag"
          @blur="onTagInputBlur"
        >
        <button
          type="button"
          class="fed__submit"
          :disabled="!canSubmit"
          @click="submit"
        >
          <Icon name="lucide:send-horizontal" size="13" />
          <span>发布</span>
          <kbd class="fed__kbd">⌘↵</kbd>
        </button>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import type { FlashNoteDraft } from '~/features/flash/types'

const emit = defineEmits<{
  submit: [draft: FlashNoteDraft]
}>()

type MoodId = 'idea' | 'todo' | 'memo'
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

const content = ref('')
const tags = ref<string[]>([])
const tagDraft = ref('')
const focused = ref(false)
const mood = ref<MoodId>('idea')
const showTagInput = ref(false)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const tagInputRef = ref<HTMLInputElement | null>(null)

const placeholder = computed(() => placeholderByMood[mood.value])
const canSubmit = computed(() => content.value.trim().length > 0)

function commitTag() {
  const t = tagDraft.value.trim().replace(/^#/, '')
  if (!t) return
  if (tags.value.length >= 6) {
    tagDraft.value = ''
    return
  }
  if (!tags.value.includes(t)) {
    tags.value.push(t)
  }
  tagDraft.value = ''
}

function removeTag(t: string) {
  tags.value = tags.value.filter((x) => x !== t)
}

function onTagButtonClick() {
  showTagInput.value = true
  void nextTick(() => tagInputRef.value?.focus())
}

function onTagInputBlur() {
  if (tagDraft.value.trim()) commitTag()
  showTagInput.value = false
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

function submit() {
  if (!canSubmit.value) return
  if (tagDraft.value.trim()) commitTag()
  emit('submit', {
    content: content.value.trim(),
    tags: [...tags.value],
  })
  content.value = ''
  tags.value = []
  tagDraft.value = ''
  showTagInput.value = false
  mood.value = 'idea'
}
</script>

<style lang="scss" scoped>
.fed {
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;

  &--focused {
    border-color: var(--accent);
    box-shadow:
      var(--shadow-card),
      0 0 0 3px var(--accent-soft);
  }
}

.fed__header {
  display: flex;
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
  transition: all 0.18s;

  &:hover {
    color: var(--accent);
  }

  &--active {
    background: var(--surface-1);
    color: var(--accent);
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
  padding: 0.25rem 1rem 0.5rem;

  &::placeholder {
    color: var(--text-faint);
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
  color: var(--accent);
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
  color: var(--accent);
  cursor: pointer;
  border-radius: $radius-full;
  padding: 0;

  &:hover {
    background: rgba(0, 0, 0, 0.06);
  }
}

.fed__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0.625rem 0.5rem 0.75rem;
  border-top: 1px dashed var(--border-soft);
}

.fed__tools {
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  flex-wrap: wrap;
}

.fed__tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-soft);
  cursor: pointer;
  border-radius: $radius-sm;
  transition:
    color 0.18s,
    background 0.18s;

  &:hover {
    color: var(--accent);
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

.fed__publish {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.fed__tag-input {
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
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4375rem 0.875rem;
  border: none;
  border-radius: $radius-full;
  background: var(--accent);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s;

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
