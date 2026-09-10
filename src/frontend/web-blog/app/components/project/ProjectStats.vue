<!--
  @file ProjectStats.vue
  @description 项目概览统计卡片组件
  @author TixXin
  @since 2025-03-17
-->

<template>
  <section class="card project-stats">
    <h3 class="project-stats__title"><Icon name="lucide:bar-chart-2" size="14" /> 项目概览</h3>
    <div class="project-stats__list">
      <div v-for="stat in stats" :key="stat.label" class="project-stats__item">
        <span class="project-stats__label">{{ stat.label }}</span>
        <span class="project-stats__value">{{ stat.value }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ProjectStats as ProjectStatsType } from '~/features/project/types'

defineProps<{
  stats: ProjectStatsType[]
}>()
</script>

<style lang="scss" scoped>
.project-stats {
  padding: 1.25rem;
}

.project-stats__title {
  font-size: 0.8125rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.project-stats__list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.project-stats__item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.project-stats__label {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.project-stats__value {
  font-size: 1.125rem;
  font-weight: 700;
}
</style>
