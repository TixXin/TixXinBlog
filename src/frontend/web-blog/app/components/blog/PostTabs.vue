<!--
  @file PostTabs.vue
  @description 文章与朋友圈共用的内容导航，统一图标、标签间距和选中状态
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="post-tabs">
    <div class="page-title__icon-wrap" aria-hidden="true">
      <Icon :name="modelValue === 'moments' ? 'lucide:messages-square' : 'lucide:newspaper'" size="18" />
    </div>
    <nav class="post-tabs__links no-scrollbar" aria-label="内容类型">
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.value"
        :to="tab.value === 'moments' ? '/moments' : '/'"
        class="tab-btn post-tabs__link"
        :class="{ 'tab-active': modelValue === tab.value }"
        :aria-current="modelValue === tab.value ? 'page' : undefined"
      >
        {{ tab.label }}
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
import type { PostTab } from '~/features/post/types'

defineProps<{
  modelValue: string
  tabs: PostTab[]
}>()
</script>

<style lang="scss" scoped>
.post-tabs {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  min-width: 0;
  max-width: 100%;
}

.post-tabs__links {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  min-width: 0;
  overflow-x: auto;
}

.post-tabs__link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-height: 44px;

  &.tab-active::after {
    bottom: 0;
  }

  // 焦点轮廓放在链接内部，避免被可横向滚动的导航容器裁切。
  &:focus-visible {
    outline-offset: -2px;
  }
}
</style>
