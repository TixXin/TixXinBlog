<!--
  @file FlashEditorToolbar.vue
  @description 闪念编辑器底部工具栏：Markdown 格式化快捷键、标签与图片输入切换、草稿与发布按钮
  @author TixXin
  @since 2026-10-21
-->

<template>
  <footer class="fed__footer">
    <div class="fed__tools">
      <button
        type="button"
        class="fed__tool"
        :aria-label="$t('flash-moment.editor.bold')"
        @click="$emit('insert-wrap', '**', '**')"
      >
        <Icon name="lucide:bold" size="14" />
      </button>
      <button
        type="button"
        class="fed__tool"
        :aria-label="$t('flash-moment.editor.italic')"
        @click="$emit('insert-wrap', '*', '*')"
      >
        <Icon name="lucide:italic" size="14" />
      </button>
      <button
        type="button"
        class="fed__tool"
        :aria-label="$t('flash-moment.editor.list')"
        @click="$emit('insert-prefix', '- ')"
      >
        <Icon name="lucide:list" size="14" />
      </button>
      <button
        type="button"
        class="fed__tool"
        :aria-label="$t('flash-moment.editor.todo')"
        @click="$emit('insert-prefix', '- [ ] ')"
      >
        <Icon name="lucide:check-square" size="14" />
      </button>
      <button
        type="button"
        class="fed__tool"
        :aria-label="$t('flash-moment.editor.quote')"
        @click="$emit('insert-prefix', '> ')"
      >
        <Icon name="lucide:quote" size="14" />
      </button>
      <button
        type="button"
        class="fed__tool"
        :aria-label="$t('flash-moment.editor.code')"
        @click="$emit('insert-wrap', '`', '`')"
      >
        <Icon name="lucide:code" size="14" />
      </button>
      <span class="fed__tool-divider" aria-hidden="true" />
      <button type="button" class="fed__tool" :aria-label="$t('flash-moment.editor.addTag')" @click="onTagButtonClick">
        <Icon name="lucide:hash" size="14" />
      </button>
      <button
        type="button"
        class="fed__tool"
        :class="{ 'fed__tool--active': showImageInput || imagesCount > 0 }"
        :aria-label="$t('flash-moment.editor.imagesAria', { count: imagesCount })"
        :title="$t('flash-moment.editor.imagesTitle', { count: imagesCount })"
        @click="$emit('image-click')"
      >
        <Icon name="lucide:paperclip" size="14" />
        <span v-if="imagesCount > 0" class="fed__tool-count">{{ imagesCount }}</span>
      </button>
      <button
        type="button"
        class="fed__tool"
        :aria-label="$t('flash-moment.editor.emojiAria')"
        :title="$t('flash-moment.editor.emojiTitle')"
        disabled
      >
        <Icon name="lucide:smile" size="14" />
      </button>
    </div>

    <div class="fed__publish">
      <input
        v-show="showTagInput"
        ref="tagInputRef"
        :value="tagDraft"
        type="text"
        :aria-label="$t('flash-moment.editor.newTag')"
        class="fed__tag-input"
        :placeholder="$t('flash-moment.editor.newTagPlaceholder')"
        maxlength="20"
        @input="$emit('update:tagDraft', ($event.target as HTMLInputElement).value)"
        @keydown.enter.prevent="$emit('commit-tag')"
        @keydown.,.prevent="$emit('commit-tag')"
        @keydown.space.prevent="$emit('commit-tag')"
        @blur="$emit('tag-blur')"
      />
      <button type="button" class="fed__tool fed__tool--text" :disabled="!canSubmit" @click="$emit('submit', true)">
        {{ $t('flash-moment.editor.saveDraft') }}
      </button>
      <button
        type="button"
        class="fed__submit"
        :aria-busy="submitting"
        :aria-label="$t('flash-moment.editor.publishAria')"
        aria-keyshortcuts="Control+Enter Meta+Enter"
        :disabled="!canSubmit"
        @click="$emit('submit', false)"
      >
        <Icon name="lucide:send-horizontal" size="13" />
        <span>{{ $t('flash-moment.editor.publish') }}</span>
        <kbd class="fed__kbd" aria-hidden="true">Ctrl/⌘↵</kbd>
      </button>
    </div>
  </footer>
</template>

<script setup lang="ts">
defineProps<{
  canSubmit: boolean
  submitting: boolean
  imagesCount: number
  showImageInput: boolean
  showTagInput: boolean
  tagDraft: string
}>()

const emit = defineEmits<{
  'insert-wrap': [left: string, right: string]
  'insert-prefix': [prefix: string]
  'tag-click': []
  'image-click': []
  submit: [asDraft: boolean]
  'update:tagDraft': [val: string]
  'commit-tag': []
  'tag-blur': []
}>()

const tagInputRef = ref<HTMLInputElement | null>(null)

function onTagButtonClick() {
  emit('tag-click')
  void nextTick(() => tagInputRef.value?.focus())
}

defineExpose({
  focusTagInput: () => tagInputRef.value?.focus(),
})
</script>

<style lang="scss" scoped>
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
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--text-soft);
  cursor: var(--interaction-cursor, pointer);
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
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:disabled {
    opacity: 0.4;
    cursor: var(--interaction-cursor, not-allowed);
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
  font-family: inherit;
  font-weight: 600;
  letter-spacing: 0.04em;
}
</style>
