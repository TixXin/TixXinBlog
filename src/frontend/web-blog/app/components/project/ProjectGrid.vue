<!--
  @file ProjectGrid.vue
  @description 项目网格容器组件
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="project-grid">
    <ProjectCard
      v-for="project in projects"
      :key="project.id"
      :project="project"
      :interactive="interactive"
      show-details
      @tag="$emit('tag', $event)"
      @open="$emit('open', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import type { ProjectItem } from '~/features/project/types'

defineProps<{ projects: ProjectItem[]; interactive: boolean }>()
defineEmits<{ tag: [label: string]; open: [id: number] }>()
</script>

<style lang="scss" scoped>
.project-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;

  @media (min-width: $breakpoint-md) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
