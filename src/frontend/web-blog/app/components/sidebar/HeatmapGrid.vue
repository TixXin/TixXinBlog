<!--
  @file HeatmapGrid.vue
  @description 活跃度热力图组件，以 GitHub 风格网格展示近期活动数据
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="heatmap">
    <div class="heatmap__header">
      <span class="heatmap__title">{{ $t('layout.sidebar.heatmap.title') }}</span>
      <span class="heatmap__subtitle">{{ $t('layout.sidebar.heatmap.subtitle', { weeks: 15 }) }}</span>
    </div>
    <div class="heatmap__body">
      <div class="heatmap__week-labels">
        <span>{{ $t('layout.sidebar.calendar.weekdays.mon') }}</span>
        <span />
        <span>{{ $t('layout.sidebar.calendar.weekdays.wed') }}</span>
        <span />
        <span>{{ $t('layout.sidebar.calendar.weekdays.fri') }}</span>
        <span />
        <span>{{ $t('layout.sidebar.calendar.weekdays.sun') }}</span>
      </div>
      <div
        ref="gridRef"
        class="heatmap__grid"
        role="group"
        :aria-label="$t('layout.sidebar.heatmap.gridLabel')"
        @mouseover="onCellEnter"
        @mouseout="onCellLeave"
        @focusin="onCellEnter"
        @focusout="onCellLeave"
      >
        <button
          v-for="(cell, i) in cells"
          :key="i"
          type="button"
          class="heatmap__cell"
          :data-idx="i"
          :tabindex="i === focusedIndex ? 0 : -1"
          :aria-label="
            $t('layout.sidebar.heatmap.cellLabel', {
              date: cell.date,
              articles: cell.articles,
              comments: cell.comments,
            })
          "
          :style="{ background: heatmapColor(cell.level) }"
          @keydown="moveCell($event, i)"
        />
      </div>
    </div>
    <div class="heatmap__legend">
      <span class="heatmap__legend-text">Less</span>
      <div v-for="n in 5" :key="n" class="heatmap__legend-dot" :style="{ background: heatmapColor(n - 1) }" />
      <span class="heatmap__legend-text">More</span>
    </div>

    <Teleport to="body">
      <div ref="tooltipRef" class="heatmap-tooltip" :style="tooltipStyle">
        <template v-if="activeCell">
          <div class="heatmap-tooltip__date">{{ activeCell.date }} {{ activeCell.weekday }}</div>
          <template v-if="activeCell.level > 0">
            <div class="heatmap-tooltip__level">
              <span class="heatmap-tooltip__dot" :style="{ background: heatmapLightColor(activeCell.level) }" />
              {{ $t('layout.sidebar.heatmap.level') }}
            </div>
            <div class="heatmap-tooltip__detail">{{ cellDetail(activeCell) }}</div>
          </template>
          <div v-else class="heatmap-tooltip__inactive">{{ $t('layout.sidebar.heatmap.inactive') }}</div>
        </template>
        <div class="heatmap-tooltip__arrow" />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
interface HeatmapCell {
  date: string
  weekday: string
  level: number
  articles: number
  comments: number
}

const { t } = useI18n()
const weekdayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const lightColors = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39']

const gridRef = ref<HTMLElement | null>(null)
const tooltipRef = ref<HTMLElement | null>(null)
const hoveredIdx = ref<number | null>(null)
const tooltipPos = ref({ left: 0, top: 0 })
const tooltipVisible = ref(false)

const activeCell = computed(() => {
  if (hoveredIdx.value === null) return null
  return cells.value[hoveredIdx.value] ?? null
})

const tooltipStyle = computed(() => ({
  left: `${tooltipPos.value.left}px`,
  top: `${tooltipPos.value.top}px`,
  opacity: tooltipVisible.value && activeCell.value ? '1' : '0',
  pointerEvents: 'none' as const,
}))

const props = defineProps<{ activity: { date: string; articles: number; comments: number }[] }>()
const focusedIndex = ref(0)
const cells = computed<HeatmapCell[]>(() =>
  props.activity.map((item) => {
    const total = item.articles + item.comments
    return {
      ...item,
      weekday: t(
        `layout.sidebar.heatmap.weekdays.${weekdayKeys[(new Date(`${item.date}T00:00:00Z`).getUTCDay() + 6) % 7]}`,
      ),
      level: total === 0 ? 0 : total <= 2 ? 1 : total <= 5 ? 2 : total <= 10 ? 3 : 4,
    }
  }),
)

// 刷新后日期数量可能减少，保留有效的 Tab 入口并清除已移除日期的提示。
watch(
  () => cells.value.length,
  (length) => {
    focusedIndex.value = Math.max(0, Math.min(focusedIndex.value, length - 1))
    if (hoveredIdx.value !== null && hoveredIdx.value >= length) {
      hoveredIdx.value = null
      tooltipVisible.value = false
    }
  },
)

function moveCell(event: KeyboardEvent, index: number) {
  const changes: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }
  const change = changes[event.key]
  if (change === undefined) return
  event.preventDefault()
  focusedIndex.value = Math.max(0, Math.min(cells.value.length - 1, index + change))
  gridRef.value?.querySelectorAll<HTMLButtonElement>('button')[focusedIndex.value]?.focus()
}

function heatmapColor(level: number) {
  const colors = ['var(--heatmap-0)', 'var(--heatmap-1)', 'var(--heatmap-2)', 'var(--heatmap-3)', 'var(--heatmap-4)']
  return colors[level] ?? colors[0]
}

function heatmapLightColor(level: number) {
  return lightColors[level] ?? lightColors[0]
}

function cellDetail(cell: HeatmapCell) {
  const parts: string[] = []
  if (cell.articles > 0) parts.push(t('layout.sidebar.heatmap.articles', { count: cell.articles }))
  if (cell.comments > 0) parts.push(t('layout.sidebar.heatmap.comments', { count: cell.comments }))
  return parts.length > 0 ? parts.join(t('layout.sidebar.heatmap.separator')) : t('layout.sidebar.heatmap.empty')
}

function onCellEnter(e: Event) {
  const target = e.target as HTMLElement
  const idx = target.dataset.idx
  if (idx === undefined) return

  hoveredIdx.value = Number(idx)
  if (e.type === 'focusin') focusedIndex.value = Number(idx)

  const rect = target.getBoundingClientRect()
  tooltipPos.value = {
    left: rect.left + rect.width / 2,
    top: rect.top,
  }
  tooltipVisible.value = true
}

function onCellLeave(e: Event) {
  const target = e.target as HTMLElement
  if (target.dataset.idx === undefined) return
  tooltipVisible.value = false
  hoveredIdx.value = null
}
</script>

<style lang="scss" scoped>
.heatmap {
  margin-top: 0.5rem;
  background: var(--heatmap-bg);
  border: 1px solid var(--heatmap-border);
  border-radius: 12px;
  padding: 12px;
}

.heatmap__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.heatmap__title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-soft);
}

.heatmap__subtitle {
  font-size: 10px;
  color: var(--text-soft);
}

.heatmap__body {
  display: flex;
  gap: 3px;
  align-items: flex-start;
}

.heatmap__week-labels {
  display: grid;
  grid-template-rows: repeat(7, 10px);
  gap: 3px;
  font-size: 9px;
  color: var(--text-soft);
  text-align: right;
  padding-right: 2px;

  span {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    width: 12px;
    height: 10px;
    line-height: 10px;
  }
}

.heatmap__grid {
  display: grid;
  grid-template-rows: repeat(7, 10px);
  grid-template-columns: repeat(15, 10px);
  grid-auto-flow: column;
  gap: 3px;
}

.heatmap__cell {
  padding: 0;
  border: 0;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  cursor: var(--interaction-cursor, pointer);
  transition:
    transform 0.15s,
    box-shadow 0.15s,
    background 0.3s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    transform: scale(1.3);
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.15);
    z-index: 5;
    position: relative;
  }
}

.heatmap__legend {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-end;
  margin-top: 0.5rem;
  color: var(--text-soft);
}

.heatmap__legend-text {
  font-size: 9px;
}

.heatmap__legend-dot {
  width: 9px;
  height: 9px;
  border-radius: 2px;
}
</style>

<style lang="scss">
.heatmap-tooltip {
  position: fixed;
  z-index: 9999;
  transform: translate(-50%, -110%);
  background: var(--tooltip-bg);
  color: var(--tooltip-text);
  font-size: 11px;
  padding: 6px 12px;
  border-radius: 8px;
  box-shadow: var(--tooltip-shadow);
  line-height: 1.6;
  white-space: nowrap;
  transition: opacity 0.15s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  pointer-events: none;
}

.heatmap-tooltip__arrow {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  top: 100%;
  border: 5px solid transparent;
  border-top-color: var(--tooltip-bg);
}

.heatmap-tooltip__date {
  font-weight: 600;
  margin-bottom: 1px;
}

.heatmap-tooltip__level {
  display: flex;
  align-items: center;
  gap: 5px;
}

.heatmap-tooltip__dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 2px;
  flex-shrink: 0;
}

.heatmap-tooltip__detail {
  opacity: 0.7;
  margin-top: 1px;
}

.heatmap-tooltip__inactive {
  opacity: 0.5;
  font-style: italic;
}
</style>
