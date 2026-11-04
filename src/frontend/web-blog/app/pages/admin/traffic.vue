<!--
  @file traffic.vue
  @description 后台访问统计：近 7/30/90 天的浏览与访客趋势、热门页面、来源与设备分布；数字来自匿名汇总
-->
<template>
  <section class="admin-traffic">
    <header class="admin-page-header admin-traffic__header">
      <div>
        <h1>{{ t('admin-system.traffic.title') }}</h1>
        <p>{{ t('admin-system.traffic.intro') }}</p>
      </div>
      <div class="admin-traffic__controls" role="group" :aria-label="t('admin-system.traffic.rangeLabel')">
        <button
          v-for="option in TRAFFIC_RANGES"
          :key="option"
          type="button"
          :aria-pressed="range === option"
          :class="{ 'is-active': range === option }"
          @click="range = option"
        >
          {{ t(`admin-system.traffic.ranges.${option}`) }}
        </button>
        <button type="button" :disabled="pending" :aria-busy="pending" @click="refresh">
          <Icon name="lucide:refresh-cw" size="14" />{{ t('admin-system.traffic.refresh') }}
        </button>
      </div>
    </header>
    <ClientOnly>
      <p v-if="pending && !data" role="status">{{ t('admin-system.traffic.loading') }}</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <template v-if="data">
        <p class="admin-traffic__period">
          {{ t('admin-system.traffic.period', { from: data.from, to: data.to }) }}
        </p>
        <dl class="admin-traffic__totals">
          <div>
            <dt>{{ t('admin-system.traffic.views') }}</dt>
            <dd>{{ formatNumber(data.totals.views) }}</dd>
          </div>
          <div>
            <dt :title="t('admin-system.traffic.visitorsHint')">{{ t('admin-system.traffic.visitors') }}</dt>
            <dd>{{ formatNumber(data.totals.visitors) }}</dd>
          </div>
          <div>
            <dt>{{ t('admin-system.traffic.dailyAverage') }}</dt>
            <dd>{{ formatNumber(Math.round(data.totals.views / data.days.length)) }}</dd>
          </div>
        </dl>
        <p v-if="!data.totals.views" class="admin-traffic__empty">{{ t('admin-system.traffic.empty') }}</p>
        <div class="admin-traffic__trends">
          <section>
            <h2>{{ t('admin-system.traffic.trendViews') }}</h2>
            <AdminTrendBars :days="series('views')" :label="t('admin-system.traffic.trendViews')" />
          </section>
          <section>
            <h2>{{ t('admin-system.traffic.trendVisitors') }}</h2>
            <AdminTrendBars :days="series('visitors')" :label="t('admin-system.traffic.trendVisitors')" />
          </section>
        </div>
        <div class="admin-traffic__rankings">
          <AdminTrafficRanking :title="t('admin-system.traffic.pages')" :entries="data.pages" :label="pageLabel" />
          <AdminTrafficRanking
            :title="t('admin-system.traffic.referrers')"
            :entries="data.referrers"
            :label="referrerLabel"
          />
          <AdminTrafficRanking
            :title="t('admin-system.traffic.devices')"
            :entries="data.devices"
            :label="(key) => t(`admin-system.traffic.deviceNames.${key}`)"
          />
          <AdminTrafficRanking
            :title="t('admin-system.traffic.browsers')"
            :entries="data.browsers"
            :label="(key) => t(`admin-system.traffic.browserNames.${key}`)"
          />
        </div>
      </template>
    </ClientOnly>
  </section>
</template>

<script setup lang="ts">
import { TRAFFIC_OTHER_KEY, TRAFFIC_RANGES } from '~/features/presence/traffic'
import { formatNumber } from '~/utils/format'

definePageMeta({ layout: 'admin', key: '/admin/traffic' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-system.traffic.title'), robots: 'noindex, nofollow' })
const { range, data, pending, error, refresh } = useAdminTraffic()

function series(field: 'views' | 'visitors') {
  return (data.value?.days ?? []).map((day) => ({ date: day.date, value: day[field] }))
}
const pageLabel = (key: string) => (key === TRAFFIC_OTHER_KEY ? t('admin-system.traffic.otherPages') : key)
const referrerLabel = (key: string) =>
  key === ''
    ? t('admin-system.traffic.direct')
    : key === TRAFFIC_OTHER_KEY
      ? t('admin-system.traffic.otherReferrers')
      : key
</script>

<style scoped lang="scss">
.admin-traffic {
  display: flex;
  flex-direction: column;
  gap: var(--admin-gap);
  min-width: 0;

  h2 {
    margin: 0 0 0.75rem;
    font-size: 0.9375rem;
    font-weight: 600;
  }
}

.admin-traffic__header {
  flex-wrap: wrap;
  gap: 0.75rem;
}

.admin-traffic__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;

  button {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: transparent;
    color: var(--text-secondary);
    font-size: 0.8125rem;
    cursor: pointer;

    &.is-active {
      border-color: var(--accent);
      color: var(--accent-text);
    }
  }
}

.admin-traffic__period,
.admin-traffic__empty {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.admin-traffic__totals {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: 0.75rem;
  margin: 0;

  div {
    padding: 0.875rem 1rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--surface-1);
  }
  dt {
    color: var(--text-muted);
    font-size: 0.8125rem;
  }
  dd {
    margin: 0.25rem 0 0;
    font-size: 1.5rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
}

.admin-traffic__trends {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  gap: 0.75rem;

  section {
    min-width: 0;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--surface-1);
  }
  // 复用概览页的迷你柱状图，这里放大高度作为主图
  :deep(.trend-bars__plot) {
    height: 7rem;
  }
}

.admin-traffic__rankings {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  gap: 0.75rem;
}
</style>
