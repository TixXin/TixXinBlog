<!--
  @file LinkGrid.vue
  @description 友链网格容器组件
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="link-grid">
    <LinkCard v-for="link in links" :key="link.id" :link="link" />
  </div>
</template>

<script setup lang="ts">
import type { LinkItem } from '~/features/link/types'

defineProps<{
  links: LinkItem[]
}>()
</script>

<style lang="scss" scoped>
// 列数按主栏实际宽度自动排：三套主题主栏宽窄不同，按窗口断点会在窄主栏里挤成三列
.link-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 16.5rem), 1fr));
  gap: 0.875rem;
  margin-bottom: 0;
}
</style>
