<!--
  @file TabCompactTools.vue
  @description 标签页移动端与窄屏下紧凑工具栏（分类筛选、设置与新建分类入口）
  @author TixXin
  @since 2026-04-11
-->

<template>
  <div class="tabs-page__compact-tools">
    <label for="bookmark-group">{{ $t('misc.tab.page.groupLabel') }}</label>
    <select
      id="bookmark-group"
      :value="activeCategoryId ?? ''"
      @change="$emit('selectCategory', ($event.target as HTMLSelectElement).value || null)"
    >
      <option value="">{{ $t('misc.tab.page.allBookmarks') }}</option>
      <option v-for="category in categories" :key="category.id" :value="category.id">
        {{ $t('misc.tab.page.groupOption', { name: category.name, count: categoryCounts[category.id] || 0 }) }}
      </option>
    </select>
    <button type="button" aria-haspopup="dialog" :aria-expanded="settingsOpen" @click="$emit('openSettings')">
      <Icon name="lucide:settings" size="18" />{{ $t('misc.tab.page.settings') }}
    </button>
    <button v-if="!isReadOnly" type="button" @click="$emit('addCategory')">
      <Icon name="lucide:folder-plus" size="18" />{{ $t('misc.tab.page.newCategory') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { BookmarkCategory } from '~/features/tab/types'

interface Props {
  categories: BookmarkCategory[]
  activeCategoryId: string | null
  categoryCounts: Record<string, number>
  settingsOpen?: boolean
  isReadOnly?: boolean
}

withDefaults(defineProps<Props>(), {
  settingsOpen: false,
  isReadOnly: false,
})

defineEmits<{
  selectCategory: [categoryId: string | null]
  openSettings: []
  addCategory: []
}>()
</script>

<style lang="scss" scoped>
.tabs-page__compact-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  max-width: 48rem;

  label {
    cursor: var(--interaction-cursor, pointer);
    font-size: 0.875rem;
    color: var(--text-soft);
  }

  select {
    flex: 1;
    min-width: 9rem;
    max-width: 100%;
  }

  select,
  button {
    min-height: 44px;
    padding: 0.5rem 0.75rem;
    color: var(--text-main);
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: $radius-md;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }

  @media (min-width: 1025px) {
    display: none;
  }
}
</style>
