<!-- @file PromptToolbar.vue @description 提示词页面工具栏：视图切换、搜索框、分类筛选与筛选条件标签 -->
<template>
  <div class="prompts-toolbar">
    <div class="prompts-views" :aria-label="$t('misc.prompt.page.viewsLabel')">
      <button
        ref="publicViewButton"
        type="button"
        :aria-pressed="!draftView"
        :disabled="!ready"
        @click="$emit('setView', false)"
      >
        {{ $t('misc.prompt.page.viewAll')
        }}<span v-if="metadata" class="prompts-views__count">{{ metadata.stats.prompts }}</span></button
      ><button
        v-if="isOwner"
        type="button"
        :aria-pressed="draftView"
        :disabled="!ready"
        @click="$emit('setView', true)"
      >
        <Icon name="lucide:file-pen-line" size="14" />{{ $t('misc.prompt.page.viewDrafts') }}
      </button>
    </div>
    <CommonSearchBox
      :model-value="keyword"
      :disabled="!ready"
      :placeholder="$t('misc.prompt.page.searchPlaceholder')"
      :label="$t('misc.prompt.page.searchLabel')"
      @update:model-value="$emit('update:keyword', $event)"
      @compositionstart="$emit('startComposition')"
      @compositionend="$emit('endComposition', $event)"
      @keydown.enter="$emit('submitSearch')"
    />
  </div>
  <div class="prompts-filters">
    <label
      ><Icon name="lucide:sliders-horizontal" size="14" /><select
        :value="query.model || ''"
        :disabled="!ready"
        :aria-label="$t('misc.prompt.page.modelFilterLabel')"
        @change="$emit('changeQuery', { model: ($event.target as HTMLSelectElement).value || undefined })"
      >
        <option value="">{{ $t('misc.prompt.page.allModels') }}</option>
        <option v-if="query.model && !metadata?.models.some((item) => item.label === query.model)" :value="query.model">
          {{ query.model }}
        </option>
        <option v-for="model in metadata?.models || []" :key="model.label" :value="model.label">
          {{ model.label }} · {{ model.count }}
        </option>
      </select></label
    >
    <div class="prompts-tags" :aria-label="$t('misc.prompt.page.tagFilterLabel')">
      <button
        type="button"
        :aria-pressed="!query.tag"
        :disabled="!ready"
        @click="$emit('changeQuery', { tag: undefined })"
      >
        {{ $t('misc.prompt.page.allTags') }}</button
      ><button
        v-for="tag in visibleTags"
        :key="tag.label"
        type="button"
        :aria-pressed="query.tag === tag.label"
        :disabled="!ready"
        @click="$emit('changeQuery', { tag: query.tag === tag.label ? undefined : tag.label })"
      >
        {{ tag.label }}
      </button>
      <button
        v-if="(metadata?.tags.length || 0) > 7"
        type="button"
        :aria-expanded="allTags"
        @click="allTags = !allTags"
      >
        {{ allTags ? $t('misc.prompt.page.collapseTags') : $t('misc.prompt.page.moreTags')
        }}<Icon :name="allTags ? 'lucide:chevron-up' : 'lucide:chevron-down'" size="12" />
      </button>
    </div>
    <button
      v-if="filtered"
      type="button"
      class="prompts-clear"
      @click="$emit('changeQuery', { q: undefined, model: undefined, tag: undefined })"
    >
      {{ $t('misc.prompt.page.clearFilters') }}
    </button>
  </div>
  <div v-if="filtered" class="prompts-selection" role="group" :aria-label="$t('misc.prompt.page.selectionLabel')">
    <span>{{
      currentError
        ? $t('misc.prompt.page.filterIncomplete')
        : currentPending || currentStale
          ? $t('misc.prompt.page.filtering')
          : $t(
              draftView ? 'misc.prompt.page.foundDrafts' : 'misc.prompt.page.foundPrompts',
              { count: total ?? 0 },
              total ?? 0,
            )
    }}</span>
    <button
      v-if="query.q"
      type="button"
      :disabled="!ready"
      :aria-label="$t('misc.prompt.page.removeKeyword', { value: query.q })"
      @click="$emit('changeQuery', { q: undefined })"
    >
      <Icon name="lucide:search" size="12" /><span>{{ query.q }}</span
      ><Icon name="lucide:x" size="12" />
    </button>
    <button
      v-if="query.model"
      type="button"
      :disabled="!ready"
      :aria-label="$t('misc.prompt.page.removeModel', { value: query.model })"
      @click="$emit('changeQuery', { model: undefined })"
    >
      <span>{{ query.model }}</span
      ><Icon name="lucide:x" size="12" />
    </button>
    <button
      v-if="query.tag"
      type="button"
      :disabled="!ready"
      :aria-label="$t('misc.prompt.page.removeTag', { value: query.tag })"
      @click="$emit('changeQuery', { tag: undefined })"
    >
      <span>{{ query.tag }}</span
      ><Icon name="lucide:x" size="12" />
    </button>
  </div>
</template>
<script setup lang="ts">
import type { PromptMetadata, PromptQuery } from '~/features/prompt/types'

const props = defineProps<{
  ready: boolean
  draftView: boolean
  isOwner: boolean
  metadata?: PromptMetadata | null
  query: PromptQuery
  filtered: boolean
  currentError: string
  currentPending: boolean
  currentStale: boolean
  total: number | null
  keyword: string
}>()

defineEmits<{
  changeQuery: [patch: Partial<PromptQuery>]
  setView: [draft: boolean]
  'update:keyword': [val: string]
  submitSearch: []
  startComposition: []
  endComposition: [event: CompositionEvent]
}>()

const allTags = ref(false)
const publicViewButton = ref<HTMLButtonElement | null>(null)

const visibleTags = computed(() => {
  const tags = allTags.value ? [...(props.metadata?.tags ?? [])] : (props.metadata?.tags ?? []).slice(0, 7)
  if (props.query.tag && !tags.some((tag) => tag.label === props.query.tag))
    tags.push({ label: props.query.tag, count: 0 })
  return tags
})

defineExpose({
  focusPublicView: () => publicViewButton.value?.focus(),
})
</script>
<style scoped lang="scss">
.prompts-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin: 1rem 0 0.65rem;
}
.prompts-views {
  display: flex;
  gap: 1.25rem;
}
.prompts-views button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 42px;
  color: var(--text-soft);
  font-size: 0.8rem;
  border-bottom: 2px solid transparent;
}
.prompts-views button[aria-pressed='true'] {
  color: var(--text-main);
  border-color: var(--accent);
}
.prompts-views__count {
  font-size: 0.6rem;
  color: var(--text-soft);
  padding: 0.1rem 0.4rem;
  border-radius: 0.3rem;
  background: var(--surface-2);
}
.prompts-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  margin-bottom: 1.5rem;
}
.prompts-filters label {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--text-soft);
}
.prompts-filters select {
  max-width: 170px;
  min-height: 38px;
  background: transparent;
  border: 0;
  color: var(--text-muted);
  font-size: 0.72rem;
}
.prompts-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.prompts-tags button {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  min-height: 34px;
  font-size: 0.72rem;
  padding: 0.35rem 0.7rem;
  border-radius: 2rem;
  border: 1px solid transparent;
  color: var(--text-soft);
}
.prompts-tags button[aria-pressed='true'] {
  color: var(--text-main);
  background: var(--surface-2);
  border-color: var(--border);
}
.prompts-clear {
  color: var(--accent-text);
  font-size: 0.7rem;
  min-height: 38px;
  margin-left: auto;
}
.prompts-selection {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin: -0.25rem 0 1.25rem;
  color: var(--text-muted);
  font-size: 0.75rem;
}
.prompts-selection > span {
  margin-right: 0.25rem;
  font-variant-numeric: tabular-nums;
}
.prompts-selection button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  max-width: 100%;
  min-height: 36px;
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--surface-2);
  color: var(--text-main);
}
.prompts-selection button span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.prompts-selection button:hover {
  border-color: var(--accent);
}
.prompts-tags button {
  transition:
    background-color 0.16s,
    border-color 0.16s,
    color 0.16s;
}
.prompts-tags button:hover {
  background: var(--accent-soft);
  color: var(--accent-text);
}
@media (prefers-reduced-motion: reduce) {
  .prompts-tags button {
    transition: none;
  }
}
button:disabled {
  opacity: 0.45;
  cursor: default;
}
@media (max-width: 640px) {
  .prompts-toolbar {
    gap: 0.75rem;
  }
  .prompts-toolbar :deep(.search-box) {
    width: 100%;
    max-width: none;
  }
  .prompts-filters {
    gap: 0.4rem;
    margin-bottom: 1rem;
  }
  .prompts-tags {
    flex: 1 1 100%;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: thin;
    padding-block: 0.15rem;
  }
  .prompts-tags button {
    flex-shrink: 0;
    min-height: 40px;
  }
}
</style>
