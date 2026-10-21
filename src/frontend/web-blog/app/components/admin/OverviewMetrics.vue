<!--
  @file OverviewMetrics.vue
  @description 管理概览顶部的四张统计卡片：内容总数、近 30 天互动、累计浏览与待处理互动；
               内容与互动附按日趋势（只画有真实日期的数据，浏览量没有按日记录故不画趋势），分区不可用时显示占位而非 0
-->
<template>
  <div class="overview-metrics">
    <article v-for="metric in metrics" :key="metric.key" class="admin-card overview-metric">
      <div class="overview-metric__top">
        <p class="overview-metric__label">{{ metric.label }}</p>
        <span class="overview-metric__icon-badge" :class="`is-${metric.key}`">
          <Icon :name="metric.icon" aria-hidden="true" />
        </span>
      </div>
      <p class="overview-metric__value">{{ metric.value ?? '—' }}</p>
      <p class="overview-metric__hint">{{ metric.hint }}</p>
      <AdminTrendBars v-if="metric.trend" class="overview-metric__trend" :days="metric.trend" :label="metric.label" />
    </article>
  </div>
</template>

<script setup lang="ts">
import { overviewDomains, overviewTasks } from '~/features/admin/overview'
import type { AdminOverview } from '~/features/admin/types'

const props = defineProps<{ overview: AdminOverview }>()
const { t, n } = useI18n()

const counts = computed(() => props.overview.counts)
const trends = computed(() => props.overview.trends)
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)
const series = (key: 'content' | 'interactions') =>
  trends.value?.map((day) => ({ date: day.date, value: day[key] })) ?? null

const metrics = computed(() => {
  const value = counts.value
  const contentTotal = value ? sum(overviewDomains.map((domain) => value[domain.total] ?? 0)) : null
  const pending = value ? sum(overviewTasks.map((task) => value[task.key] ?? 0)) : null
  const recentContent = trends.value ? sum(trends.value.map((day) => day.content)) : null
  const recentInteractions = trends.value ? sum(trends.value.map((day) => day.interactions)) : null
  const format = (count: number | null) => (count === null ? null : n(count))
  return [
    {
      key: 'content',
      icon: 'lucide:library',
      label: t('admin-system.overview.metrics.content'),
      value: format(contentTotal),
      hint:
        recentContent === null
          ? t('admin-system.overview.metrics.trendUnavailable')
          : t('admin-system.overview.metrics.contentHint', { count: recentContent }),
      trend: series('content'),
    },
    {
      key: 'interactions',
      icon: 'lucide:messages-square',
      label: t('admin-system.overview.metrics.interactions'),
      value: format(recentInteractions),
      hint:
        recentInteractions === null
          ? t('admin-system.overview.metrics.trendUnavailable')
          : t('admin-system.overview.metrics.interactionsHint'),
      trend: series('interactions'),
    },
    {
      key: 'views',
      icon: 'lucide:eye',
      label: t('admin-system.overview.metrics.views'),
      value: format(value?.views ?? null),
      hint: t('admin-system.overview.metrics.viewsHint'),
      trend: null,
    },
    {
      key: 'pending',
      icon: 'lucide:inbox',
      label: t('admin-system.overview.metrics.pending'),
      value: format(pending),
      hint: pending ? t('admin-system.overview.metrics.pendingHint') : t('admin-system.overview.metrics.pendingDone'),
      trend: null,
    },
  ]
})
</script>

<style scoped lang="scss">
.overview-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--admin-gap);
}
.overview-metric {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 1.125rem;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
    transform: none;
  }
  &:hover {
    border-color: var(--border-hover);
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
  }
  &__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  &__label {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.875rem;
    font-weight: 500;
  }
  &__icon-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.875rem;
    height: 1.875rem;
    border-radius: 0.375rem;
    font-size: 0.9375rem;
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    color: var(--accent-text);

    &.is-pending {
      background: color-mix(in srgb, var(--warning-text) 12%, transparent);
      color: var(--warning-text);
    }
  }
  &__value {
    margin: 0.625rem 0 0;
    color: var(--text-main);
    font-size: 1.625rem;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  &__hint {
    margin: 0.25rem 0 0;
    color: var(--text-soft);
    font-size: 0.75rem;
  }
  &__trend {
    margin-top: auto;
    padding-top: 0.875rem;
  }
}
@media (max-width: 1024px) {
  .overview-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 390px) {
  .overview-metrics {
    gap: 0.625rem;
  }
  .overview-metric {
    padding: 0.875rem;

    &__value {
      font-size: 1.375rem;
    }
  }
}
</style>
