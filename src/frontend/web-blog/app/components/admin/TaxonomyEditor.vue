<!-- @file TaxonomyEditor.vue @description 专栏与标签的新建与重命名表单：类型在编辑时锁定，仅标签可选颜色。 -->
<template>
  <form ref="form" class="taxonomy__editor" @submit.prevent="emit('save')">
    <h2>
      {{ t(editingId === null ? 'admin-content.taxonomy.editor.create' : 'admin-content.taxonomy.editor.edit') }}
    </h2>
    <fieldset :disabled="working || pending || !ready">
      <label
        >{{ t('admin-content.taxonomy.editor.kind')
        }}<select v-model="kind" :disabled="editingId !== null">
          <option value="folders">{{ t('admin-content.taxonomy.folders') }}</option>
          <option value="tags">{{ t('admin-content.taxonomy.tags') }}</option>
        </select></label
      >
      <label>{{ t('admin-content.taxonomy.editor.name') }}<input v-model="label" required maxlength="64" /></label>
      <label v-if="kind === 'tags'"
        >{{ t('admin-content.taxonomy.editor.color')
        }}<select v-model="color">
          <option v-for="option in colors" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select></label
      >
      <button :aria-busy="saving" type="submit" :disabled="!label.trim()">
        {{
          t(
            working
              ? 'admin-content.taxonomy.editor.saving'
              : editingId === null
                ? 'admin-content.taxonomy.editor.add'
                : 'admin-content.taxonomy.editor.saveEdit',
          )
        }}
      </button>
      <button v-if="editingId !== null || label" type="button" @click="emit('cancel')">
        {{ t('admin-content.taxonomy.editor.cancel') }}
      </button>
    </fieldset>
    <p v-if="editingId !== null">{{ t('admin-content.taxonomy.editor.renameHint') }}</p>
  </form>
</template>
<script setup lang="ts">
import type { AdminTaxonomyKind } from '~/features/post/adminTaxonomy'

defineProps<{
  editingId: number | null
  working: boolean
  pending: boolean
  ready: boolean
  saving: boolean
  colors: { value: string; label: string }[]
}>()
const emit = defineEmits<{ save: []; cancel: [] }>()
const kind = defineModel<AdminTaxonomyKind>('kind', { required: true })
const label = defineModel<string>('label', { required: true })
const color = defineModel<string>('color', { required: true })
const { t } = useI18n()
const form = ref<HTMLFormElement | null>(null)
/** 进入编辑后把焦点交给名称输入框 */
function focusName() {
  form.value?.querySelector('input')?.focus()
}
defineExpose({ focusName })
</script>
<style scoped lang="scss">
@use '~/assets/styles/admin-taxonomy' as taxonomy;

h2 {
  @include taxonomy.heading;
}
.taxonomy__editor > p {
  @include taxonomy.hint;
}
.taxonomy__editor {
  @include taxonomy.card;
}
fieldset {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 0.75rem;
  border: 0;
  padding: 0;
}
label {
  display: grid;
  min-width: 0;
  gap: 0.4rem;
}
@media (max-width: 600px) {
  fieldset label {
    width: 100%;
  }
  .taxonomy__editor {
    @include taxonomy.card-narrow;
  }
}
</style>
