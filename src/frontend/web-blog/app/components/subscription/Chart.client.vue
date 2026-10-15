<!-- @file Chart.client.vue @description 页面懒加载 ECharts 按需模块；响应式、主题和减少动态偏好同步 -->
<template>
  <VChart
    ref="chart"
    class="subscription-chart"
    :style="height ? { height: `${height}px` } : undefined"
    :data-subscription-chart="kind"
    :data-chart-ready="rendered"
    :option="option"
    :init-options="{ renderer: 'svg' }"
    autoresize
    :update-options="{ notMerge: true }"
    role="img"
    :aria-label="label"
    @rendered="rendered = true"
  />
</template>
<script setup lang="ts">
import { use } from 'echarts/core'
import { PieChart, BarChart, LineChart } from 'echarts/charts'
import { TooltipComponent, GridComponent, AriaComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import type { EChartsOption } from 'echarts'
use([PieChart, BarChart, LineChart, TooltipComponent, GridComponent, AriaComponent, SVGRenderer])
const props = defineProps<{
  kind: 'pie' | 'bar' | 'line'
  labels: string[]
  values: number[]
  label: string
  currency: string
  step?: boolean
  horizontal?: boolean
  height?: number
  formattedValues?: string[]
}>()
const { currentThemeId } = useLayoutTheme(),
  colorMode = useColorMode(),
  reduced = ref(true)
const rendered = ref(false),
  chart = ref<{ getDom(): HTMLElement } | null>(null)
const colors = ref({
  text: '#64748b',
  main: '#1e293b',
  border: '#d1d5db',
  accent: '#334155',
  secondary: '#475569',
  surface: '#ffffff',
})
let media: MediaQueryList | undefined
function readColors() {
  const css = getComputedStyle(chart.value?.getDom() ?? document.documentElement)
  colors.value = {
    text: css.getPropertyValue('--text-muted').trim() || '#64748b',
    main: css.getPropertyValue('--text-main').trim() || '#1e293b',
    secondary: css.getPropertyValue('--accent-text').trim() || '#475569',
    border: css.getPropertyValue('--border').trim() || '#d1d5db',
    accent: css.getPropertyValue('--accent').trim() || '#059669',
    surface: css.getPropertyValue('--surface-1').trim() || '#ffffff',
  }
}
function motion() {
  reduced.value = media?.matches ?? true
}
watch(
  [currentThemeId, () => colorMode.value],
  async () => {
    await nextTick()
    readColors()
  },
  { flush: 'post' },
)
onMounted(() => {
  readColors()
  media = matchMedia('(prefers-reduced-motion: reduce)')
  motion()
  media.addEventListener('change', motion)
})
onScopeDispose(() => media?.removeEventListener('change', motion))
const option = computed<EChartsOption>(() => {
  const base: EChartsOption = {
    animation: !reduced.value,
    animationDuration: 250,
    textStyle: { color: colors.value.text, fontFamily: 'inherit' },
    color: [
      colors.value.accent,
      '#5484bb',
      '#c6984b',
      '#a177b9',
      '#72a79a',
      '#b87676',
      '#8498a2',
      '#887c62',
      '#759462',
    ],
    aria: { enabled: true, label: { description: props.label }, decal: { show: props.kind === 'pie' } },
    tooltip: {
      trigger: props.kind === 'pie' ? 'item' : 'axis',
      renderMode: 'richText',
      confine: true,
      backgroundColor: colors.value.surface,
      textStyle: { color: colors.value.text },
      valueFormatter: (value, dataIndex) =>
        `${props.currency} ${typeof dataIndex === 'number' ? (props.formattedValues?.[dataIndex] ?? String(value)) : String(value)}`,
    },
  }
  if (props.kind === 'pie')
    return {
      ...base,
      series: [
        {
          type: 'pie',
          radius: ['32%', '62%'],
          center: ['50%', '46%'],
          avoidLabelOverlap: true,
          label: { fontSize: 11, color: colors.value.text, overflow: 'truncate', width: 64 },
          data: props.labels.map((name, i) => ({ name, value: props.values[i] ?? 0 })),
        },
      ],
    }
  if (props.kind === 'bar' && props.horizontal) {
    const valueWidth = Math.min(
      136,
      Math.max(54, ...(props.formattedValues ?? []).map((value) => value.length * 7 + 14)),
    )
    return {
      ...base,
      grid: { left: 88, right: valueWidth, top: 8, bottom: 8, containLabel: false },
      xAxis: { type: 'value', show: false, min: 0 },
      yAxis: {
        type: 'category',
        inverse: true,
        data: props.labels,
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { color: colors.value.text, fontSize: 15, margin: 14, width: 74, overflow: 'truncate' },
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 28,
          label: {
            show: true,
            position: 'right',
            distance: 12,
            color: colors.value.main,
            fontSize: 15,
            fontWeight: 550,
            formatter: (params) => props.formattedValues?.[params.dataIndex] ?? String(params.value),
          },
          data: props.values.map((value, index) => ({
            value,
            itemStyle: { color: index % 2 ? colors.value.secondary : colors.value.accent, borderRadius: 3 },
          })),
        },
      ],
    }
  }
  return {
    ...base,
    grid: { left: 16, right: 24, top: 24, bottom: 28, containLabel: true },
    xAxis: {
      type: 'category',
      data: props.labels,
      axisLabel: {
        color: colors.value.text,
        hideOverlap: true,
        rotate: props.kind === 'line' ? 25 : 0,
        width: 65,
        overflow: 'truncate',
      },
    },
    yAxis: {
      type: 'value',
      name: props.currency,
      nameTextStyle: { color: colors.value.text },
      axisLabel: { color: colors.value.text },
      splitLine: { lineStyle: { color: colors.value.border } },
    },
    series: [
      props.kind === 'bar'
        ? { type: 'bar', data: props.values, barMaxWidth: 42 }
        : {
            type: 'line',
            data: props.values,
            step: props.step ? 'end' : false,
            symbol: 'circle',
            symbolSize: 6,
            connectNulls: false,
          },
    ],
  }
})
</script>
<style scoped>
.subscription-chart {
  width: 100%;
  height: 280px;
  min-width: 0;
}
</style>
