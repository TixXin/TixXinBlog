<!--
  @file FlashEditor.vue
  @description 闪念输入框：多行文本 + 标签输入 + 发布按钮
  @author TixXin
  @since 2026-04-11
-->

<template>
  <div class="flash-editor">
    <textarea
      v-model="content"
      class="flash-editor__textarea"
      placeholder="此刻的灵感..."
      rows="3"
      maxlength="500"
      @keydown.ctrl.enter="submit"
      @keydown.meta.enter="submit"
    />

    <div class="flash-editor__tags">
      <span v-for="t in tags" :key="t" class="flash-editor__tag">
        #{{ t }}
        <button
          type="button"
          class="flash-editor__tag-remove"
          aria-label="移除标签"
          @click="removeTag(t)"
        >
          <Icon name="lucide:x" size="10" />
        </button>
      </span>
      <input
        v-model="tagDraft"
        type="text"
        class="flash-editor__tag-input"
        :placeholder="tags.length === 0 ? '加个标签...' : ''"
        maxlength="20"
        @keydown.enter.prevent="commitTag"
        @keydown.,.prevent="commitTag"
        @keydown.space.prevent="commitTag"
      >
    </div>

    <div class="flash-editor__footer">
      <span class="flash-editor__hint">
        <Icon name="lucide:keyboard" size="12" />
        Ctrl/⌘ + Enter 发布
      </span>
      <span class="flash-editor__count">{{ content.length }}/500</span>
      <button
        type="button"
        class="flash-editor__submit"
        :disabled="!canSubmit"
        @click="submit"
      >
        <Icon name="lucide:zap" size="14" />
        发布
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FlashNoteDraft } from '~/features/flash/types'

const emit = defineEmits<{
  submit: [draft: FlashNoteDraft]
}>()

const content = ref('')
const tags = ref<string[]>([])
const tagDraft = ref('')

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

function submit() {
  if (!canSubmit.value) return
  // 草稿提交前若 tagDraft 还有未提交的内容，先收一次
  if (tagDraft.value.trim()) commitTag()
  emit('submit', {
    content: content.value.trim(),
    tags: [...tags.value],
  })
  content.value = ''
  tags.value = []
  tagDraft.value = ''
}
</script>

<style lang="scss" scoped>
.flash-editor {
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  padding: 1rem 1.125rem 0.875rem;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  transition: border-color 0.2s;

  &:focus-within {
    border-color: var(--accent);
  }
}

.flash-editor__textarea {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-main);
  font-size: 0.9375rem;
  line-height: 1.6;
  resize: vertical;
  font-family: inherit;
  min-height: 4.5rem;

  &::placeholder {
    color: var(--text-faint);
  }
}

.flash-editor__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
}

.flash-editor__tag {
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

.flash-editor__tag-remove {
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

.flash-editor__tag-input {
  flex: 1;
  min-width: 7rem;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-main);
  font-size: 0.75rem;
  padding: 0.25rem 0;

  &::placeholder {
    color: var(--text-faint);
  }
}

.flash-editor__footer {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--border-soft);
  font-size: 0.6875rem;
  color: var(--text-soft);
}

.flash-editor__hint {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.flash-editor__count {
  margin-left: auto;
  color: var(--text-faint);
}

.flash-editor__submit {
  display: inline-flex;
  align-items: center;
  gap: 0.3125rem;
  padding: 0.375rem 0.875rem;
  border: none;
  border-radius: $radius-md;
  background: var(--accent);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    opacity: 0.88;
  }
}
</style>
