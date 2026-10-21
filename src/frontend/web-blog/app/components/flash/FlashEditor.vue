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
      <!-- 顶部条：mood 切换 + 字数；紧凑态隐藏 -->
      <FlashEditorHeader
        v-show="expanded"
        v-model:mood="mood"
        :moods="moods"
        :count="content.length"
        :max-length="maxLength"
      />

      <!-- 主输入区：textarea + 右上角展开/收起按钮 -->
      <div class="fed__editor-wrap">
        <textarea
          ref="textareaRef"
          v-model="content"
          class="fed__textarea"
          :placeholder="placeholder"
          :rows="expanded ? 4 : 1"
          :maxlength="maxLength"
          :aria-label="$t('flash-moment.editor.content')"
          @focus="focused = true"
          @blur="focused = false"
          @keydown="onEditorKeydown"
        />
        <button
          type="button"
          class="fed__expand-toggle"
          :aria-label="expanded ? $t('flash-moment.editor.collapse') : $t('flash-moment.editor.expand')"
          :title="expanded ? $t('flash-moment.editor.collapse') : $t('flash-moment.editor.expand')"
          @click="toggleExpand"
        >
          <Icon :name="expanded ? 'lucide:minimize-2' : 'lucide:maximize-2'" size="12" />
        </button>
      </div>

      <!-- 标签 chips -->
      <div v-if="tags.length > 0 || tagDraft" class="fed__tags">
        <span v-for="tag in tags" :key="tag" class="fed__tag">
          #{{ tag }}
          <button
            type="button"
            class="fed__tag-remove"
            :aria-label="$t('flash-moment.editor.removeTag')"
            @click="removeTag(tag)"
          >
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
        <Icon name="lucide:images" size="14" />{{ $t('flash-moment.editor.pickMedia') }}
      </button>

      <!-- 图片 URL 列表（折叠态，paperclip 触发） -->
      <FlashEditorImages
        v-model="imageInput"
        :show="showImageInput"
        :input-id="imageInputId"
        :images="images"
        @blur="commitImages"
      />

      <!-- 底部工具栏 -->
      <FlashEditorToolbar
        v-model:tag-draft="tagDraft"
        :can-submit="canSubmit"
        :submitting="submitting"
        :images-count="images.length"
        :show-image-input="showImageInput"
        :show-tag-input="showTagInput"
        @insert-wrap="insertWrap"
        @insert-prefix="insertPrefix"
        @tag-click="onTagButtonClick"
        @image-click="onImageButtonClick"
        @commit-tag="commitTag"
        @tag-blur="onTagInputBlur"
        @submit="submit"
      />
    </fieldset>
  </div>
  <AdminMediaPicker v-model:open="mediaOpen" @selected="selectMedia" />
</template>

<script setup lang="ts">
import type { FlashNoteDraft, FlashType } from '~/features/flash/types'
import { useFlashEditorForm } from '~/features/flash/useFlashEditorForm'

const props = withDefaults(
  defineProps<{ submitting?: boolean; initial?: FlashNoteDraft | null; maxLength?: number }>(),
  { maxLength: 500, initial: null, submitting: false },
)

const emit = defineEmits<{
  submit: [draft: FlashNoteDraft]
  dirty: [dirty: boolean]
}>()

const { t } = useI18n()
const moods = computed<{ id: FlashType; icon: string; label: string }[]>(() => [
  { id: 'idea', icon: 'lucide:lightbulb', label: t('flash-moment.flashType.idea') },
  { id: 'todo', icon: 'lucide:check-circle', label: t('flash-moment.flashType.todo') },
  { id: 'memo', icon: 'lucide:file-text', label: t('flash-moment.flashType.memo') },
])

const textareaRef = ref<HTMLTextAreaElement | null>(null)

const {
  content,
  validationError,
  tags,
  tagDraft,
  focused,
  mood,
  showTagInput,
  showImageInput,
  imageInput,
  images,
  mediaOpen,
  imageInputId,
  expanded,
  placeholder,
  canSubmit,
  onEditorKeydown,
  selectMedia,
  toggleExpand,
  commitTag,
  removeTag,
  onTagButtonClick,
  onTagInputBlur,
  onImageButtonClick,
  commitImages,
  insertWrap,
  insertPrefix,
  submit,
} = useFlashEditorForm({
  initial: toRef(props, 'initial'),
  maxLength: toRef(props, 'maxLength'),
  submitting: toRef(props, 'submitting'),
  textareaRef,
  emitSubmit: (draft) => emit('submit', draft),
  emitDirty: (dirty) => emit('dirty', dirty),
})

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
  cursor: var(--interaction-cursor, pointer);
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

.fed--compact {
  .fed__textarea {
    min-height: 2.75rem;
    line-height: 1.5;
    padding: 0.625rem 2.25rem 0.5rem 1rem;
    resize: none;
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
  cursor: var(--interaction-cursor, pointer);
  border-radius: $radius-full;
  padding: 0;

  &:hover {
    background: rgba(0, 0, 0, 0.06);
  }
}

.fed__tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
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

.fed__tool--text {
  width: auto;
  min-height: 40px;
  padding: 0.375rem 0.75rem;
  white-space: nowrap;
  gap: 0.375rem;
}
</style>
