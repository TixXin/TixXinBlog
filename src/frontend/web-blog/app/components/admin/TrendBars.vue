<!--
  @file TrendBars.vue
  @description 统计卡片里的按日迷你柱状图：每天一根柱（2px 间隙、圆角柱顶、基线对齐），历史柱为弱化色、
               最后一天为强调色；悬停显示该日日期与数量，读屏读取文字摘要
-->
<template>
  <div class="trend-bars" @pointerleave="active = null">
    <svg
      class="trend-bars__plot"
      :viewBox="`0 0 ${width} ${HEIGHT}`"
      preserveAspectRatio="none"
      role="img"
      :aria-label="summary"
    >
      <rect
        v-for="(day, index) in days"
        :key="day.date"
        class="trend-bars__bar"
        :class="{ 'is-latest': index === days.length - 1, 'is-active': index === active }"
        :x="index * STEP"
        :y="HEIGHT - barHeight(day.value)"
        :width="BAR"
        :height="barHeight(day.value)"
        rx="1.5"
      />
      <!-- 命中区比柱子大：整列可悬停 -->
      <rect
        v-for="(day, index) in days"
        :key="`hit-${day.date}`"
        class="trend-bars__hit"
        :x="index * STEP - GAP / 2"
        y="0"
        :width="STEP"
        :height="HEIGHT"
        @pointerenter="active = index"
      />
    </svg>
    <p v-if="activeDay" class="trend-bars__tooltip" :style="{ left: `${tooltipLeft}%` }" aria-hidden="true">
      <span>{{ formatDay(activeDay.date) }}</span
      ><strong>{{ activeDay.value }}</strong>
    </p>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  days: { date: string; value: number }[]
  /** 读屏摘要，如「近 30 天每日新增内容」 */
  label: string
}>()
const { t, locale } = useI18n()

const HEIGHT = 32
const BAR = 6
const GAP = 2
const STEP = BAR + GAP
// 全为 0 时柱子仍留 1px 基线，表明「有数据、数量为零」而不是缺失
const MIN_BAR = 1

const width = computed(() => Math.max(props.days.length * STEP - GAP, 1))
const max = computed(() => Math.max(1, ...props.days.map((day) => day.value)))
const active = ref<number | null>(null)
const activeDay = computed(() => (active.value === null ? null : props.days[active.value]))
const tooltipLeft = computed(() => (active.value === null ? 0 : ((active.value * STEP + BAR / 2) / width.value) * 100))

function barHeight(value: number) {
  return Math.max(MIN_BAR, (value / max.value) * HEIGHT)
}
function formatDay(date: string) {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  return new Intl.DateTimeFormat(locale.value, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  )
}

const summary = computed(() => {
  const total = props.days.reduce((sum, day) => sum + day.value, 0)
  const peak = props.days.reduce((best, day) => (day.value > best.value ? day : best), props.days[0]!)
  return peak && peak.value > 0
    ? t('admin-system.overview.trendSummary', {
        label: props.label,
        total,
        peak: peak.value,
        date: formatDay(peak.date),
      })
    : t('admin-system.overview.trendEmpty', { label: props.label })
})
</script>

<style scoped lang="scss">
.trend-bars {
  position: relative;
}
.trend-bars__plot {
  display: block;
  width: 100%;
  height: 2rem;
  overflow: visible;
}
.trend-bars__bar {
  fill: color-mix(in srgb, var(--text-soft) 35%, transparent);

  &.is-latest {
    fill: var(--accent);
  }
  &.is-active {
    fill: var(--text-muted);
  }
  &.is-latest.is-active {
    fill: var(--accent-text);
  }
}
.trend-bars__hit {
  fill: transparent;
}
.trend-bars__tooltip {
  position: absolute;
  bottom: calc(100% + 0.375rem);
  z-index: 2;
  display: flex;
  gap: 0.375rem;
  margin: 0;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  background: var(--tooltip-bg);
  box-shadow: var(--tooltip-shadow);
  color: var(--tooltip-text);
  font-size: 0.75rem;
  white-space: nowrap;
  transform: translateX(-50%);
  pointer-events: none;

  strong {
    font-weight: 600;
  }
}
</style>
