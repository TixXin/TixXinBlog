<!-- @file EditorVisual.vue @description 提示词编辑器视觉区块：效果图预览、来源切换与图片元数据 -->
<template>
  <section class="prompt-editor__visual">
    <h3>{{ $t('misc.prompt.editor.visualTitle') }}</h3>
    <p>{{ $t('misc.prompt.editor.visualHint') }}</p>
    <div class="prompt-editor__preview">
      <CommonImageFrame
        v-if="previewUrl"
        :src="previewUrl"
        :alt="form.imageAlt || form.title || $t('misc.prompt.editor.previewAlt')"
        fit="contain"
        loading="eager"
      />
      <div v-else class="prompt-editor__placeholder">
        <Icon name="lucide:image-plus" size="30" /><span>{{ $t('misc.prompt.editor.placeholder') }}</span>
      </div>
    </div>
    <div class="prompt-editor__source" role="group" :aria-label="$t('misc.prompt.editor.sourceLabel')">
      <button type="button" :aria-pressed="form.imageSource === 'media'" @click="form.imageSource = 'media'">
        {{ $t('misc.prompt.editor.sourceMedia') }}</button
      ><button type="button" :aria-pressed="form.imageSource === 'external'" @click="form.imageSource = 'external'">
        {{ $t('misc.prompt.editor.sourceExternal') }}
      </button>
    </div>
    <button
      v-if="form.imageSource === 'media'"
      ref="mediaButton"
      v-bind="fieldAttributes('mediaId')"
      type="button"
      class="prompt-editor__secondary"
      @click="$emit('openMedia')"
    >
      <Icon name="lucide:upload" size="16" />{{
        form.mediaId ? $t('misc.prompt.editor.changeImage') : $t('misc.prompt.editor.chooseImage')
      }}</button
    ><small
      v-if="attempted && fieldErrors.mediaId"
      id="prompt-editor-mediaId-error"
      class="prompt-editor__field-error"
      >{{ fieldErrors.mediaId }}</small
    ><label v-if="form.imageSource === 'external'"
      >{{ $t('misc.prompt.editor.externalUrl')
      }}<input
        v-model="form.externalImageUrl"
        v-bind="fieldAttributes('externalImageUrl')"
        type="url"
        maxlength="2048"
        placeholder="https://…"
      /><small>{{ $t('misc.prompt.editor.externalHint') }}</small
      ><small
        v-if="attempted && fieldErrors.externalImageUrl"
        id="prompt-editor-externalImageUrl-error"
        class="prompt-editor__field-error"
        >{{ fieldErrors.externalImageUrl }}</small
      ></label
    ><label
      >{{ $t('misc.prompt.editor.fieldImageAlt')
      }}<input
        v-model="form.imageAlt"
        v-bind="fieldAttributes('imageAlt')"
        maxlength="240"
        :placeholder="$t('misc.prompt.editor.imageAltPlaceholder')"
      /><small
        v-if="attempted && fieldErrors.imageAlt"
        id="prompt-editor-imageAlt-error"
        class="prompt-editor__field-error"
        >{{ fieldErrors.imageAlt }}</small
      ></label
    >
  </section>
</template>
<script setup lang="ts">
import type { PromptForm } from '~/features/prompt/types'

const props = defineProps<{
  attempted: boolean
  fieldErrors: Partial<Record<keyof PromptForm, string>>
}>()

defineEmits<{
  openMedia: []
}>()

const form = inject<PromptForm>('promptForm')!
const { t } = useI18n()
const mediaButton = ref<HTMLButtonElement | null>(null)

const previewUrl = computed(() =>
  form.imageSource === 'external' ? form.externalImageUrl : form.mediaId ? `/api/v1/media/${form.mediaId}.webp` : '',
)

const fieldLabelKeys: Partial<Record<keyof PromptForm, string>> = {
  externalImageUrl: 'externalUrl',
  imageAlt: 'fieldImageAlt',
}

function fieldAttributes(field: keyof PromptForm) {
  const descriptions = [props.attempted && props.fieldErrors[field] ? `prompt-editor-${field}-error` : '']
    .filter(Boolean)
    .join(' ')
  return {
    'data-prompt-field': field,
    'aria-label': fieldLabelKeys[field] ? t(`misc.prompt.editor.${fieldLabelKeys[field]}`) : undefined,
    'aria-invalid': (props.attempted && !!props.fieldErrors[field]) || undefined,
    'aria-describedby': descriptions || undefined,
  }
}

defineExpose({
  focusMediaButton: () => mediaButton.value?.focus({ preventScroll: true }),
})
</script>
<style scoped lang="scss">
.prompt-editor__visual > p {
  font-size: 0.75rem;
  color: var(--text-soft);
  margin: 0.4rem 0 1rem;
}
.prompt-editor__preview {
  min-height: 180px;
  border-radius: 0.7rem;
  border: 1px solid var(--border);
  background: var(--surface-2);
  overflow: hidden;
}
.prompt-editor__preview :deep(.image-frame) {
  height: 240px;
}
.prompt-editor__placeholder {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  align-items: center;
  justify-content: center;
  min-height: 230px;
  color: var(--text-soft);
  font-size: 0.75rem;
}
.prompt-editor__source {
  display: flex;
  gap: 0.25rem;
  margin: 1rem 0 0.6rem;
}
.prompt-editor__source button {
  padding: 0.55rem 0.8rem;
  min-height: 40px;
  font-size: 0.75rem;
  color: var(--text-soft);
  border-radius: 0.4rem;
}
.prompt-editor__source button[aria-pressed='true'] {
  background: var(--surface-2);
  color: var(--text-main);
}
label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  margin-bottom: 1rem;
}
input {
  display: block;
  width: 100%;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.7rem 0.8rem;
  color: var(--text-main);
  font-size: 0.8125rem;
  font-weight: 400;
  margin-top: 0.45rem;
  line-height: 1.75;
}
input::placeholder {
  color: var(--text-soft);
  opacity: 0.85;
}
input:focus {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
small {
  display: block;
  color: var(--text-soft);
  font-size: 0.68rem;
  font-weight: 400;
  margin-top: 0.4rem;
  line-height: 1.6;
}
.prompt-editor__field-error {
  color: var(--danger);
}
[aria-invalid='true'] {
  border-color: var(--danger);
}
.prompt-editor__secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 42px;
  padding: 0.55rem 0.85rem;
  border-radius: 0.5rem;
  border: 1px solid var(--border);
  font-size: 0.75rem;
  background: var(--surface-2);
  color: var(--text-main);
}
.prompt-editor__visual > .prompt-editor__secondary {
  margin-bottom: 1rem;
  width: 100%;
  justify-content: center;
}
@media (max-width: 720px) {
  .prompt-editor__preview :deep(.image-frame) {
    height: 200px;
  }
}
@media (max-height: 520px) {
  .prompt-editor__preview :deep(.image-frame) {
    height: 160px;
  }
  .prompt-editor__placeholder {
    min-height: 160px;
  }
}
</style>
