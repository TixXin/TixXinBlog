<!--
  @file TrafficMap.client.vue
  @description 访问统计的世界地图：按国家访客数着色（ECharts map 按需引入，懒加载），悬停显示国名与访客数。
               国界数据为 public/geo/world.json（Natural Earth 中国视角，港澳台归入中国，生成方式见 scripts/geo/world-map.mjs），
               只在打开本卡片时读取一次；未知地区不上图，在下方另行说明。
-->
<template>
  <section class="traffic-map">
    <h2>{{ t('admin-system.traffic.map.title') }}</h2>
    <p v-if="failed" role="alert" class="traffic-map__note">{{ t('admin-system.traffic.map.loadFailed') }}</p>
    <div v-else-if="ready" class="traffic-map__frame">
      <VChart
        ref="chart"
        class="traffic-map__chart"
        :option="option"
        :init-options="{ renderer: 'svg' }"
        autoresize
        :update-options="{ notMerge: true }"
        role="img"
        :aria-label="summary"
        :data-map-ready="rendered"
        @rendered="rendered = true"
      />
    </div>
    <p v-else class="traffic-map__note" role="status">{{ t('admin-system.traffic.map.loading') }}</p>
    <p v-if="unknown" class="traffic-map__note">
      {{ t('admin-system.traffic.map.unknown', { count: formatNumber(unknown) }) }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { registerMap, use } from 'echarts/core'
import { MapChart } from 'echarts/charts'
import { AriaComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import type { EChartsOption } from 'echarts'
import { countryName, type TrafficEntry } from '~/features/presence/traffic'
import { formatNumber } from '~/utils/format'

use([MapChart, TooltipComponent, VisualMapComponent, AriaComponent, SVGRenderer])

const MAP_NAME = 'tixxin-world'
/** 国界数据整页只读一次，切换范围或重新挂载都复用 */
let mapLoading: Promise<void> | null = null
function loadMap() {
  mapLoading ??= $fetch<Record<string, unknown>>('/geo/world.json').then((geo) => {
    registerMap(MAP_NAME, geo as never)
  })
  return mapLoading
}

const props = defineProps<{ countries: TrafficEntry[] }>()
const { t, locale } = useI18n()
const { currentThemeId } = useLayoutTheme()
const colorMode = useColorMode()
const chart = ref<{ getDom(): HTMLElement } | null>(null)
const ready = ref(false),
  failed = ref(false),
  rendered = ref(false)
const colors = ref({
  text: '#64748b',
  border: '#d1d5db',
  empty: '#e5e7eb',
  low: '#c7d2fe',
  high: '#3f5cc6',
  surface: '#fff',
})

/** 把 #rgb、#rrggbb 或 rgb() 写成带透明度的 rgba()；无法识别时原样返回 */
function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)?.[1]
  const full = hex?.length === 3 ? [...hex].map((c) => c + c).join('') : hex
  if (full) {
    const [r, g, b] = [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16))
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  const rgb = /^rgba?\(([^,]+),([^,]+),([^,)]+)/.exec(color)
  return rgb ? `rgba(${rgb[1]!.trim()}, ${rgb[2]!.trim()}, ${rgb[3]!.trim()}, ${alpha})` : color
}

function readColors() {
  const css = getComputedStyle(chart.value?.getDom() ?? document.documentElement)
  const value = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  const accent = value('--accent-action', '#3f5cc6')
  colors.value = {
    text: value('--text-muted', '#64748b'),
    border: value('--border', '#d1d5db'),
    empty: value('--surface-3', '#e5e7eb'),
    // 低值取强调色的半透明版本，深色主题下同样可辨；ECharts 需要可插值的颜色，不能用 color-mix()
    low: withAlpha(accent, 0.45),
    high: accent,
    surface: value('--surface-1', '#ffffff'),
  }
}
watch([currentThemeId, () => colorMode.value], async () => {
  await nextTick()
  readColors()
})
onMounted(async () => {
  readColors()
  try {
    await loadMap()
    ready.value = true
  } catch {
    mapLoading = null
    failed.value = true
  }
})

const known = computed(() => props.countries.filter((entry) => entry.key))
const unknown = computed(() => props.countries.find((entry) => !entry.key)?.count ?? 0)
const summary = computed(() =>
  known.value.length
    ? t('admin-system.traffic.map.summary', {
        list: known.value
          .slice(0, 5)
          .map((entry) => `${countryName(entry.key, locale.value)} ${formatNumber(entry.count)}`)
          .join('、'),
      })
    : t('admin-system.traffic.noData'),
)
const option = computed<EChartsOption>(() => {
  const max = Math.max(1, ...known.value.map((entry) => entry.count))
  // 按平方根着色：访客集中在一两个国家时，少量访问的国家也能和没有访问的区分开；提示里仍显示原始人数
  return {
    animation: false,
    aria: { enabled: true, label: { description: summary.value } },
    tooltip: {
      trigger: 'item',
      renderMode: 'richText',
      confine: true,
      backgroundColor: colors.value.surface,
      textStyle: { color: colors.value.text },
      formatter: (params) => {
        const item = params as { name: string; data?: { count?: number } }
        const name = countryName(item.name, locale.value) || item.name
        return t('admin-system.traffic.map.tooltip', { name, count: formatNumber(item.data?.count ?? 0) })
      },
    },
    visualMap: {
      min: 0,
      max: Math.sqrt(max),
      left: 8,
      bottom: 8,
      itemHeight: 80,
      calculable: false,
      text: [formatNumber(max), '0'],
      textStyle: { color: colors.value.text },
      inRange: { color: [colors.value.low, colors.value.high] },
      outOfRange: { color: colors.value.empty },
    },
    series: [
      {
        type: 'map',
        map: MAP_NAME,
        roam: true,
        scaleLimit: { min: 1, max: 8 },
        // 南极洲已在数据中剔除；容器宽高比贴合地图，四周只留少量边距
        aspectScale: 0.85,
        top: 4,
        bottom: 4,
        left: 4,
        right: 4,
        itemStyle: { areaColor: colors.value.empty, borderColor: colors.value.border, borderWidth: 0.5 },
        emphasis: { label: { show: false }, itemStyle: { areaColor: colors.value.high } },
        select: { disabled: true },
        label: { show: false },
        data: known.value.map((entry) => ({ name: entry.key, value: Math.sqrt(entry.count), count: entry.count })),
      },
    ],
  }
})
</script>

<style scoped lang="scss">
.traffic-map {
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

/* 外层按地图比例定高，图表绝对定位铺满；vue-echarts 根元素自带高度样式，不能直接设 aspect-ratio */
.traffic-map__frame {
  position: relative;
  aspect-ratio: 2.1 / 1;
  min-height: 12rem;
}

.traffic-map__chart {
  position: absolute;
  inset: 0;
}

.traffic-map__note {
  margin: 0.5rem 0 0;
  color: var(--text-muted);
  font-size: 0.8125rem;
}
</style>
