<!--
  @file ProjectGrid.vue
  @description 项目网格容器组件
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="project-grid">
    <ProjectCard v-for="project in projects" :key="project.title" :project="project" :example="example" />
  </div>
</template>

<script setup lang="ts">
import type { ProjectItem } from '~/features/project/types'

withDefaults(
  defineProps<{
    projects: ProjectItem[]
    example?: boolean
  }>(),
  { example: false },
)
</script>

<style lang="scss" scoped>
.project-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;

  @media (min-width: $breakpoint-md) {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
