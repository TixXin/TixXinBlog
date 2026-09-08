<!--
  @file ArchiveStats.vue
  @description 文章归档侧栏：汇总统计与分类分布进度条
  @author TixXin
  @since 2026-03-20
-->

<template>
  <section class="card archive-stats">
    <h3 class="archive-stats__title"><Icon name="lucide:bar-chart-2" size="14" /> 归档概览</h3>
    <ul class="archive-stats__list">
      <li v-for="row in stats" :key="row.label" class="archive-stats__row">
        <span class="archive-stats__label">{{ row.label }}</span>
        <span class="archive-stats__value">{{ row.value }}</span>
      </li>
    </ul>

    <div class="archive-stats__divider" />

    <h4 class="archive-stats__section-title">分类分布</h4>
    <div class="archive-stats__distribution">
      <div v-for="item in distribution" :key="item.name" class="archive-stats__dist-item">
        <div class="archive-stats__dist-meta">
          <span class="archive-stats__dist-name">{{ item.name }}</span>
          <span class="archive-stats__dist-count">{{ item.count }} · {{ item.percent }}%</span>
        </div>
        <div class="archive-stats__track">
          <div class="archive-stats__fill" :style="{ width: `${item.percent}%` }" />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ArchiveStat, CategoryDistribution } from '~/features/article/types'

defineProps<{
  stats: ArchiveStat[]
  distribution: CategoryDistribution[]
}>()
</script>

<style lang="scss" scoped>
.archive-stats {
  padding: 1.25rem;
}

.archive-stats__title {
  font-size: 0.8125rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 1.25rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.archive-stats__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.archive-stats__row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.8125rem;
}

.archive-stats__label {
  color: var(--text-muted);
}

.archive-stats__value {
  font-weight: 700;
  color: var(--text-main);
}

.archive-stats__divider {
  height: 1px;
  background: var(--border);
  margin: 1.25rem 0;
}

.archive-stats__section-title {
  font-size: 0.8125rem;
  font-weight: 700;
  margin: 0 0 1rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-main);
}

.archive-stats__distribution {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.archive-stats__dist-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  margin-bottom: 0.25rem;
}

.archive-stats__dist-name {
  color: var(--text-muted);
}

.archive-stats__dist-count {
  color: var(--text-soft);
}

.archive-stats__track {
  width: 100%;
  height: 0.375rem;
  background: var(--surface-3);
  border-radius: $radius-full;
}

.archive-stats__fill {
  height: 100%;
  border-radius: $radius-full;
  background: var(--text-muted);
  transition: width 1s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  .dark & {
    background: var(--text-soft);
  }
}
</style>
