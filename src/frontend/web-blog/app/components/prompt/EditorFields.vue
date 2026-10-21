<!-- @file EditorFields.vue @description 提示词编辑器文案表单：标题、提示词、模型、标签与高级折叠项 -->
<template>
  <section class="prompt-editor__writing">
    <label
      >{{ $t('misc.prompt.editor.titleLabel')
      }}<span class="prompt-editor__required">{{ $t('misc.prompt.editor.required') }}</span
      ><input
        v-model="form.title"
        v-bind="fieldAttributes('title')"
        required
        maxlength="160"
        :placeholder="$t('misc.prompt.editor.titlePlaceholder')"
      /><small id="prompt-editor-title-count" class="prompt-editor__count"
        >{{ form.title.length }} / {{ promptFieldLimits.title }}</small
      ><small v-if="attempted && fieldErrors.title" id="prompt-editor-title-error" class="prompt-editor__field-error">{{
        fieldErrors.title
      }}</small></label
    ><label
      >{{ $t('misc.prompt.editor.descriptionLabel')
      }}<textarea
        v-model="form.description"
        v-bind="fieldAttributes('description')"
        rows="2"
        maxlength="2000"
        :placeholder="$t('misc.prompt.editor.descriptionPlaceholder')"
      /><small
        v-if="attempted && fieldErrors.description"
        id="prompt-editor-description-error"
        class="prompt-editor__field-error"
        >{{ fieldErrors.description }}</small
      ></label
    ><label
      >{{ $t('misc.prompt.editor.fieldPrompt')
      }}<span class="prompt-editor__required">{{ $t('misc.prompt.editor.required') }}</span
      ><textarea
        v-model="form.prompt"
        v-bind="fieldAttributes('prompt')"
        class="prompt-editor__prompt"
        required
        rows="8"
        maxlength="30000"
        :placeholder="$t('misc.prompt.editor.promptPlaceholder')"
        dir="auto"
      /><small id="prompt-editor-prompt-count" class="prompt-editor__count"
        >{{ form.prompt.length }} / {{ promptFieldLimits.prompt }}</small
      ><small
        v-if="attempted && fieldErrors.prompt"
        id="prompt-editor-prompt-error"
        class="prompt-editor__field-error"
        >{{ fieldErrors.prompt }}</small
      >
    </label>
    <div class="prompt-editor__row">
      <label
        >{{ $t('misc.prompt.editor.modelLabel')
        }}<input
          v-model="form.model"
          v-bind="fieldAttributes('model')"
          list="prompt-editor-models"
          maxlength="80"
          :placeholder="$t('misc.prompt.editor.modelPlaceholder')"
        /><datalist id="prompt-editor-models">
          <option v-for="model in models" :key="model" :value="model" /></datalist
        ><small
          v-if="attempted && fieldErrors.model"
          id="prompt-editor-model-error"
          class="prompt-editor__field-error"
          >{{ fieldErrors.model }}</small
        ></label
      ><label
        >{{ $t('misc.prompt.editor.tagsLabel')
        }}<input
          v-model="tagsInput"
          v-bind="fieldAttributes('tags')"
          :placeholder="$t('misc.prompt.editor.tagsPlaceholder')"
          maxlength="395"
        /><small id="prompt-editor-tags-count">{{
          $t('misc.prompt.editor.tagsCount', { count: form.tags.length })
        }}</small
        ><small v-if="attempted && fieldErrors.tags" id="prompt-editor-tags-error" class="prompt-editor__field-error">{{
          fieldErrors.tags
        }}</small></label
      >
    </div>
    <details ref="optionalDetails" class="prompt-editor__optional">
      <summary>{{ $t('misc.prompt.editor.optionalSummary') }}</summary>
      <label
        >{{ $t('misc.prompt.editor.fieldNegative')
        }}<textarea
          v-model="form.negativePrompt"
          v-bind="fieldAttributes('negativePrompt')"
          rows="3"
          maxlength="10000"
          :placeholder="$t('misc.prompt.editor.negativePlaceholder')"
          dir="auto"
        /><small id="prompt-editor-negativePrompt-count" class="prompt-editor__count"
          >{{ form.negativePrompt.length }} / {{ promptFieldLimits.negativePrompt }}</small
        ><small
          v-if="attempted && fieldErrors.negativePrompt"
          id="prompt-editor-negativePrompt-error"
          class="prompt-editor__field-error"
          >{{ fieldErrors.negativePrompt }}</small
        ></label
      ><label
        >{{ $t('misc.prompt.editor.fieldSource')
        }}<input
          v-model="form.sourceUrl"
          v-bind="fieldAttributes('sourceUrl')"
          type="url"
          maxlength="2048"
          :placeholder="$t('misc.prompt.editor.sourcePlaceholder')"
        /><small
          v-if="attempted && fieldErrors.sourceUrl"
          id="prompt-editor-sourceUrl-error"
          class="prompt-editor__field-error"
          >{{ fieldErrors.sourceUrl }}</small
        ></label
      >
    </details>
  </section>
</template>
<script setup lang="ts">
import type { PromptForm } from '~/features/prompt/types'
import { promptFieldLimits } from '~/features/prompt/editor'

const props = defineProps<{
  models: string[]
  attempted: boolean
  fieldErrors: Partial<Record<keyof PromptForm, string>>
}>()

const form = inject<PromptForm>('promptForm')!
const { t } = useI18n()
const optionalDetails = ref<HTMLDetailsElement | null>(null)

const parseTags = (value: string) => [
  ...new Set(
    value
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean),
  ),
]

// 回显标签时按界面语言使用中文逗号或英文逗号，解析时两种都接受
const tagsInput = ref(form.tags.join(t('misc.prompt.editor.tagJoiner')))
watch(tagsInput, (value) => {
  form.tags = parseTags(value)
})
watch(
  () => form.tags,
  (value) => {
    if (JSON.stringify(value) !== JSON.stringify(parseTags(tagsInput.value)))
      tagsInput.value = value.join(t('misc.prompt.editor.tagJoiner'))
  },
)

const fieldLabelKeys: Partial<Record<keyof PromptForm, string>> = {
  title: 'titleLabel',
  prompt: 'fieldPrompt',
  description: 'descriptionLabel',
  negativePrompt: 'fieldNegative',
  model: 'modelLabel',
  tags: 'tagsLabel',
  sourceUrl: 'fieldSource',
}

function fieldAttributes(field: keyof PromptForm) {
  const descriptions = [
    ['title', 'prompt', 'negativePrompt', 'tags'].includes(field) ? `prompt-editor-${field}-count` : '',
    props.attempted && props.fieldErrors[field] ? `prompt-editor-${field}-error` : '',
  ]
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
  openOptional: () => {
    if (optionalDetails.value) optionalDetails.value.open = true
  },
})
</script>
<style scoped lang="scss">
label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  margin-bottom: 1rem;
}
input,
textarea {
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
textarea {
  resize: vertical;
}
input::placeholder,
textarea::placeholder {
  color: var(--text-soft);
  opacity: 0.85;
}
input:focus,
textarea:focus {
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
.prompt-editor__required {
  color: var(--text-soft);
  font-size: 0.65rem;
  margin-left: 0.5rem;
  font-weight: 400;
}
.prompt-editor__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.prompt-editor__optional {
  font-size: 0.75rem;
  color: var(--text-soft);
}
summary {
  cursor: var(--interaction-cursor, pointer);
  padding-block: 0.5rem;
}
.prompt-editor__optional label {
  margin-top: 0.5rem;
  color: var(--text-main);
}
.prompt-editor__count {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.prompt-editor__field-error {
  color: var(--danger);
}
[aria-invalid='true'] {
  border-color: var(--danger);
}
@media (max-width: 720px) {
  .prompt-editor__row {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
