<!--
  @file SiteStatsCard.vue
  @description 右侧栏站点统计卡片组件，展示运行天数、文章数、浏览量等数据
  @author TixXin
  @since 2025-03-17
-->

<template>
  <section class="card stats-card">
    <div class="stats-card__title-row">
      <Icon name="lucide:bar-chart-2" size="16" />
      <span>站点统计</span>
    </div>

    <div class="stats-card__uptime">
      <div class="stats-card__uptime-left">
        <span class="stats-card__ping-dot" />
        <div class="stats-card__uptime-text">
          <span class="stats-card__uptime-label">站点已稳定运行</span>
          <span class="stats-card__uptime-days">{{ stats.uptimeDays.toLocaleString() }} 天</span>
        </div>
      </div>
      <Icon name="lucide:shield-check" size="20" class="stats-card__uptime-icon" />
    </div>

    <div class="stats-card__grid">
      <div v-for="item in statItems" :key="item.label" class="stats-card__item">
        <span class="stats-card__value">{{ item.value }}</span>
        <span class="stats-card__label">{{ item.label }}</span>
      </div>
    </div>

    <SidebarHeatmapGrid />
  </section>
</template>

<script setup lang="ts">
import type { SiteStats } from '~/features/stats/types'

const props = defineProps<{
  stats: SiteStats
}>()

const statItems = computed(() => [
  { label: '文章', value: props.stats.articles },
  { label: '浏览', value: props.stats.views },
  { label: '评论', value: props.stats.comments },
  { label: '标签', value: props.stats.tags },
])
</script>

<style lang="scss" scoped>
.stats-card {
  padding: 1.25rem;

  // 紧凑档（md–xl）：左栏只有 240px 宽度时，卡片 padding 收窄给内容让空间
  @media (min-width: $breakpoint-md) and (max-width: #{$breakpoint-xl - 1px}) {
    padding: 1rem 0.9rem;
  }
}

.stats-card__title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--text-main);
}

.stats-card__uptime {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  border-radius: $radius-md;
  background: var(--stat-green-bg);
  border: 1px solid var(--stat-green-border);
}

.stats-card__uptime-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.stats-card__ping-dot {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 50%;
  background: var(--stat-green-dot);
  box-shadow: 0 0 0 3px var(--stat-green-bg);
  animation: pulse-green 2s infinite;
  flex-shrink: 0;
}

.stats-card__uptime-text {
  display: flex;
  flex-direction: column;
}

.stats-card__uptime-label {
  font-size: 0.625rem;
  color: var(--stat-green);
  font-weight: 500;
}

.stats-card__uptime-days {
  font-size: 1.125rem;
  font-weight: 800;
  color: var(--stat-green);
  line-height: 1.2;
}

.stats-card__uptime-icon {
  color: var(--stat-green);
  opacity: 0.6;
}

.stats-card__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  margin-bottom: 1rem;

  // 紧凑档（md–xl）：240px 宽度下 4 列每列仅 ~45px，缩小间距避免数字挤压
  @media (min-width: $breakpoint-md) and (max-width: #{$breakpoint-xl - 1px}) {
    gap: 0.35rem;
  }
}

.stats-card__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: default;

  &:hover {
    .stats-card__value {
      color: var(--stat-green);
    }
  }
}

.stats-card__value {
  font-size: 1.25rem;
  font-weight: 800;
  transition: color 0.2s;

  // 紧凑档（md–xl）：数字字号略降，避免在 240px 宽度下挤破列宽
  @media (min-width: $breakpoint-md) and (max-width: #{$breakpoint-xl - 1px}) {
    font-size: 1.1rem;
  }
}

.stats-card__label {
  font-size: 0.625rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
}

@keyframes pulse-green {
  0%,
  100% {
    box-shadow: 0 0 0 3px var(--stat-green-bg);
  }
  50% {
    box-shadow: 0 0 0 8px transparent;
  }
}
</style>
