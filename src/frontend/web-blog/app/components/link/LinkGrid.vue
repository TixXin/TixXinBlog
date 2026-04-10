<!--
  @file LinkGrid.vue
  @description 友链网格容器组件
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="link-grid">
    <LinkCard
      v-for="link in links"
      :key="link.domain"
      :link="link"
    />
  </div>
</template>

<script setup lang="ts">
import type { LinkItem } from '~/features/link/types'

defineProps<{
  links: LinkItem[]
}>()
</script>

<style lang="scss" scoped>
.link-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 1.25rem;
  margin-bottom: 0;

  @media (min-width: $breakpoint-sm) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: $breakpoint-lg) {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
