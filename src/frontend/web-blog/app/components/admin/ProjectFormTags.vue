<!-- @file ProjectFormTags.vue @description 项目编辑表单的技术标签区块：逐条编辑名称与颜色，最多 20 项 -->
<template>
  <section :aria-label="$t('admin-media.projectForm.tagsLabel')">
    <h2>{{ $t('admin-media.projectForm.tagsTitle', { count: tags.length, max: 20 }) }}</h2>
    <div v-for="(tag, index) in tags" :key="index" class="project-editor__row">
      <label
        >{{ $t('admin-media.projectForm.tagName')
        }}<input
          :value="tag.label"
          :aria-label="$t('admin-media.projectForm.tagNameLabel', { index: index + 1 })"
          maxlength="40"
          required
          @input="changeTag(index, { label: ($event.target as HTMLInputElement).value })" /></label
      ><label
        >{{ $t('admin-media.projectForm.tagColor')
        }}<select
          :value="tag.color"
          :aria-label="$t('admin-media.projectForm.tagColorLabel', { index: index + 1 })"
          @change="changeTag(index, { color: ($event.target as HTMLSelectElement).value as ProjectTag['color'] })"
        >
          <option v-for="color in projectTagColors" :key="color" :value="color">
            {{ $t(`admin-media.projectForm.color.${color}`) }}
          </option>
        </select></label
      ><button
        type="button"
        :aria-label="$t('admin-media.projectForm.removeTagLabel', { index: index + 1 })"
        @click="
          emit(
            'change',
            tags.filter((_, i) => i !== index),
          )
        "
      >
        {{ $t('admin-media.projectForm.removeTag') }}
      </button>
    </div>
    <button
      type="button"
      :disabled="tags.length >= 20"
      @click="emit('change', [...tags, { label: '', color: 'blue' }])"
    >
      {{ $t('admin-media.projectForm.addTag') }}
    </button>
    <p>{{ $t('admin-media.projectForm.tagsHint') }}</p>
  </section>
</template>
<script setup lang="ts">
import { projectTagColors } from '~/features/project/types'
import type { ProjectTag } from '~/features/project/types'

const props = defineProps<{ tags: ProjectTag[] }>()
const emit = defineEmits<{ change: [tags: ProjectTag[]] }>()
function changeTag(index: number, patch: Partial<ProjectTag>) {
  emit(
    'change',
    props.tags.map((tag, i) => (i === index ? { ...tag, ...patch } : { ...tag })),
  )
}
</script>
<style scoped lang="scss">
@use '~/assets/styles/project-editor' as project;

@include project.form;
</style>
