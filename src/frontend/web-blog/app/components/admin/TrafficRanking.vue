<!--
  @file TrafficRanking.vue
  @description 访问统计的排行卡片：标题、按数量排序的条目、相对最大值的条形与占比；没有数据时显示空状态
-->
<template>
  <section class="traffic-ranking">
    <h2>{{ title }}</h2>
    <ol v-if="rows.length" class="traffic-ranking__list">
      <li v-for="row in rows" :key="row.key" class="traffic-ranking__row">
        <span class="traffic-ranking__bar" :style="{ width: `${Math.max(row.ratio * 100, 2)}%` }" aria-hidden="true" />
        <span class="traffic-ranking__label" :title="labelOf(row.key)">{{ labelOf(row.key) }}</span>
        <span class="traffic-ranking__count">
          {{ formatNumber(row.count) }}
          <small>{{ t('admin-system.traffic.share', { percent: row.percent }) }}</small>
        </span>
      </li>
    </ol>
    <p v-else class="traffic-ranking__empty">{{ t('admin-system.traffic.noData') }}</p>
  </section>
</template>

<script setup lang="ts">
import { trafficRows, type TrafficEntry } from '~/features/presence/traffic'
import { formatNumber } from '~/utils/format'

const props = defineProps<{
  title: string
  entries: TrafficEntry[]
  /** 键的展示文字（如空串显示“直接访问”）；缺省原样显示 */
  label?: (key: string) => string
}>()
const { t } = useI18n()
const rows = computed(() => trafficRows(props.entries))
const labelOf = (key: string) => props.label?.(key) ?? key
</script>

<style scoped lang="scss">
.traffic-ranking {
  min-width: 0;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--surface-1);

  h2 {
    margin: 0 0 0.75rem;
    font-size: 0.9375rem;
    font-weight: 600;
  }
}

.traffic-ranking__list {
  display: grid;
  gap: 0.375rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.traffic-ranking__row {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.375rem 0.5rem;
  font-size: 0.8125rem;
}

.traffic-ranking__bar {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 0.25rem;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}

.traffic-ranking__label {
  position: relative;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.traffic-ranking__count {
  position: relative;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;

  small {
    margin-left: 0.375rem;
    color: var(--text-muted);
  }
}

.traffic-ranking__empty {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.8125rem;
}
</style>
