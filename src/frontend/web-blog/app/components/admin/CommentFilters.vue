<!--
  @file CommentFilters.vue
  @description 文章评论筛选工具栏：按文章、待回复、审核状态、日期区间及关键字筛选
  @author TixXin
  @since 2026-10-21
-->
<template>
  <form class="admin-card admin-toolbar admin-comments__filters" @submit.prevent="$emit('submit')">
    <select
      :value="postId"
      :aria-label="t('admin-content.comments.filters.post')"
      :disabled="working"
      @change="onPostChange"
    >
      <option value="">{{ t('admin-content.comments.filters.allPosts') }}</option>
      <option v-for="article in articles" :key="article.id" :value="String(article.id)">{{ article.title }}</option>
    </select>
    <label>
      <input type="checkbox" :checked="unanswered" :disabled="working" @change="onUnansweredChange" />{{
        t('admin-content.comments.filters.unanswered')
      }}
    </label>
    <select
      :value="status"
      :aria-label="t('admin-content.comments.filters.status')"
      :disabled="working"
      @change="onStatusChange"
    >
      <option value="">{{ t('admin-content.comments.filters.allStatus') }}</option>
      <option v-for="(label, value) in statusLabels" :key="value" :value="value">{{ label }}</option>
    </select>
    <label>
      {{ t('admin-content.comments.filters.from') }}
      <CommonDatePicker
        :model-value="from"
        :max="to || undefined"
        :disabled="working"
        clearable
        @update:model-value="onFromChange"
        @change="$emit('submit')"
      />
    </label>
    <label>
      {{ t('admin-content.comments.filters.to') }}
      <CommonDatePicker
        :model-value="to"
        :min="from || undefined"
        :disabled="working"
        clearable
        @update:model-value="onToChange"
        @change="$emit('submit')"
      />
    </label>
    <input
      :value="search"
      :aria-label="t('admin-content.comments.filters.search')"
      :placeholder="t('admin-content.comments.filters.searchPlaceholder')"
      @input="$emit('update:search', ($event.target as HTMLInputElement).value)"
    />
    <button :aria-busy="pending" type="submit" :disabled="pending">
      {{ t('admin-content.comments.filters.submit') }}
    </button>
  </form>
</template>

<script setup lang="ts">
import type { CommentStatus } from '~/features/article/types'

withDefaults(
  defineProps<{
    articles: { id: number; title: string }[]
    statusLabels: Record<CommentStatus, string>
    postId?: string
    unanswered?: boolean
    status?: string
    from?: string
    to?: string
    search?: string
    working?: boolean
    pending?: boolean
  }>(),
  {
    postId: '',
    unanswered: false,
    status: '',
    from: '',
    to: '',
    search: '',
    working: false,
    pending: false,
  },
)

const emit = defineEmits<{
  'update:postId': [val: string]
  'update:unanswered': [val: boolean]
  'update:status': [val: string]
  'update:from': [val: string]
  'update:to': [val: string]
  'update:search': [val: string]
  submit: []
}>()

const { t } = useI18n()

function onPostChange(event: Event) {
  emit('update:postId', (event.target as HTMLSelectElement).value)
  emit('submit')
}

function onUnansweredChange(event: Event) {
  emit('update:unanswered', (event.target as HTMLInputElement).checked)
  emit('submit')
}

function onStatusChange(event: Event) {
  emit('update:status', (event.target as HTMLSelectElement).value)
  emit('submit')
}

function onFromChange(val: string) {
  emit('update:from', val)
}

function onToChange(val: string) {
  emit('update:to', val)
}
</script>

<style scoped>
.admin-comments__filters {
  padding: 0.75rem;
}
.admin-comments__filters > label {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  color: var(--text-muted);
  font-size: 0.875rem;
}
.admin-comments__filters > select,
.admin-comments__filters > input:not([type='checkbox']) {
  flex: 1 1 12rem;
}
@media (max-width: 640px) {
  .admin-comments__filters > label,
  .admin-comments__filters > select,
  .admin-comments__filters > input:not([type='checkbox']),
  .admin-comments__filters :deep(.date-picker) {
    flex: 1 1 100%;
    width: 100%;
  }
}
</style>
