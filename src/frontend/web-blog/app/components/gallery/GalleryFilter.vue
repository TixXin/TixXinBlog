<!--
  @file GalleryFilter.vue
  @description 画廊分类筛选按钮组，支持 v-model 绑定当前分类值
  @author TixXin
  @since 2026-03-20
-->

<template>
  <div class="gallery-filter" role="group" :aria-label="$t('misc.gallery.filter.label')">
    <!-- 空分类的名称由界面按语言给出，不使用接口返回的中文缺省标签 -->
    <button
      v-for="cat in categories"
      :key="cat.value === undefined ? 'all' : `category:${cat.value}`"
      type="button"
      class="gallery-filter__btn"
      :class="{ 'gallery-filter__btn--active': modelValue === cat.value }"
      :aria-pressed="modelValue === cat.value"
      :disabled="disabled"
      @click="$emit('update:modelValue', cat.value)"
    >
      {{ cat.value === '' ? $t('misc.gallery.filter.uncategorized') : cat.label
      }}<span v-if="cat.count !== undefined">{{ $t('misc.gallery.filter.count', { count: cat.count }) }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { GalleryCategory } from '~/features/gallery/types'

defineProps<{
  categories: (GalleryCategory | { label: string; value: undefined; count?: number })[]
  modelValue: string | undefined
  disabled: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string | undefined]
}>()
</script>

<style lang="scss" scoped>
.gallery-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
}

.gallery-filter__btn {
  max-width: 100%;
  overflow-wrap: anywhere;
  min-height: 44px;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  border: none;
  border-radius: $radius-sm;
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  background: var(--surface-2);
  color: var(--text-muted);

  &:hover {
    background: var(--accent-soft);
    color: var(--text-main);
  }
}

.gallery-filter__btn--active {
  background: var(--accent-action);
  color: #fff;

  &:hover {
    background: var(--accent-action);
    color: #fff;
    filter: brightness(1.05);
  }
}
</style>
