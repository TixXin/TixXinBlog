<!--
  @file GalleryFilter.vue
  @description 画廊分类筛选按钮组，支持 v-model 绑定当前分类值
  @author TixXin
  @since 2026-03-20
-->

<template>
  <div class="gallery-filter" role="toolbar" aria-label="照片分类筛选">
    <button
      v-for="cat in categories"
      :key="cat.value"
      type="button"
      class="gallery-filter__btn"
      :class="{ 'gallery-filter__btn--active': modelValue === cat.value }"
      @click="$emit('update:modelValue', cat.value)"
    >
      {{ cat.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { GalleryCategory } from '~/features/gallery/types'

defineProps<{
  categories: GalleryCategory[]
  modelValue: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
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
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  border: none;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: $transition-fast;
  background: var(--surface-2);
  color: var(--text-muted);

  &:hover {
    background: var(--accent-soft);
    color: var(--text-main);
  }
}

.gallery-filter__btn--active {
  background: var(--accent);
  color: #fff;

  &:hover {
    background: var(--accent);
    color: #fff;
    filter: brightness(1.05);
  }
}
</style>
