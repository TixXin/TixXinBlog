<!--
  @file PostTabs.vue
  @description 文章分类 Tab 栏与搜索输入框
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="main-content__header">
    <div class="post-tabs no-scrollbar">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="tab-btn"
        :class="{ 'tab-active': modelValue === tab.value }"
        @click="$emit('update:modelValue', tab.value)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="post-tabs__search">
      <Icon name="lucide:search" size="16" class="post-tabs__search-icon" />
      <input type="text" class="input-field post-tabs__search-input" placeholder="搜索站内文章、标签..." >
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PostTab } from '~/features/post/types'

defineProps<{
  modelValue: string
  tabs: PostTab[]
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<style lang="scss" scoped>
.post-tabs {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  overflow-x: auto;

  @media (min-width: $breakpoint-sm) {
    gap: 2.5rem;
  }

  // 紧凑档（sm–xl）：缩小 Tab 间距避免与搜索框挤压
  @media (min-width: $breakpoint-sm) and (max-width: #{$breakpoint-xl - 1px}) {
    gap: 1.5rem;
  }
}

.post-tabs__search {
  display: flex;
  align-items: center;
  position: relative;
  width: 100%;
  padding-bottom: 1rem;

  @media (min-width: $breakpoint-sm) {
    width: 16rem;
    padding-bottom: 0;
    margin-left: auto;
  }

  // 紧凑档（sm–xl）：搜索框缩至 12rem，给 Tab 与模式切换按钮让空间
  @media (min-width: $breakpoint-sm) and (max-width: #{$breakpoint-xl - 1px}) {
    width: 12rem;
  }
}

.post-tabs__search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-soft);
  pointer-events: none;
}

.post-tabs__search-input {
  padding-left: 2.75rem;
}
</style>
