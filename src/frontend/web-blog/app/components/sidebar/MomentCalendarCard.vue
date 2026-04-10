<!--
  @file MomentCalendarCard.vue
  @description 朋友圈右侧栏动态日历卡，按月展示发布日期标记，支持点击日期筛选
  @author TixXin
  @since 2026-04-07
-->

<template>
  <section class="card moment-calendar-card">
    <div class="moment-calendar-card__header">
      <h3 class="moment-calendar-card__title">
        <Icon name="lucide:calendar-days" size="16" />
        动态日历
      </h3>
      <div class="moment-calendar-card__nav">
        <button type="button" class="moment-calendar-card__nav-btn" aria-label="上一月" @click="prevMonth">
          <Icon name="lucide:chevron-left" size="14" />
        </button>
        <span class="moment-calendar-card__month">{{ monthLabel }}</span>
        <button
          type="button"
          class="moment-calendar-card__nav-btn"
          :disabled="isCurrentMonth"
          aria-label="下一月"
          @click="nextMonth"
        >
          <Icon name="lucide:chevron-right" size="14" />
        </button>
      </div>
    </div>

    <div class="moment-calendar-card__weekdays">
      <span v-for="wd in weekdays" :key="wd" class="moment-calendar-card__wd">{{ wd }}</span>
    </div>

    <div class="moment-calendar-card__grid">
      <span
        v-for="(day, idx) in calendarDays"
        :key="idx"
        class="moment-calendar-card__day"
        :class="{
          'is-empty': !day,
          'is-today': day?.isToday,
          'has-moment': day?.hasMoment,
          'is-future': day?.isFuture,
          'is-selected': day?.dateStr === selectedDate,
        }"
        :data-tooltip="day?.hasMoment ? dayTooltip(day) : undefined"
        @click="day?.hasMoment && onDayClick(day)"
      >
        <template v-if="day">
          {{ day.num }}
          <span v-if="day.hasMoment" class="moment-calendar-card__dot" />
        </template>
      </span>
    </div>

    <div class="moment-calendar-card__footer">
      <!-- 回到今天按钮 -->
      <button
        v-if="!isCurrentMonth"
        type="button"
        class="moment-calendar-card__today-btn"
        @click="goToday"
      >
        <Icon name="lucide:calendar-check" size="12" />
        今天
      </button>

      <div class="moment-calendar-card__footer-right">
        <!-- 连续发布天数 -->
        <span v-if="streak > 0" class="moment-calendar-card__streak">
          <Icon name="lucide:flame" size="12" class="moment-calendar-card__streak-icon" />
          连续 {{ streak }} 天
        </span>
        <span class="moment-calendar-card__legend">
          <span class="moment-calendar-card__legend-dot" />
          本月 {{ monthMomentCount }} 条动态
        </span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{
  momentDates: string[] // ISO 日期字符串数组, e.g. ['2026-04-04', '2026-04-03']
  selectedDate?: string | null
}>()

const emit = defineEmits<{
  'select-date': [date: string | null]
}>()

const weekdays = ['一', '二', '三', '四', '五', '六', '日']

const viewYear = ref(new Date().getFullYear())
const viewMonth = ref(new Date().getMonth()) // 0-indexed

const monthLabel = computed(() => `${viewYear.value}年${viewMonth.value + 1}月`)

const isCurrentMonth = computed(() => {
  const now = new Date()
  return viewYear.value === now.getFullYear() && viewMonth.value === now.getMonth()
})

function prevMonth() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11
    viewYear.value--
  } else {
    viewMonth.value--
  }
}

function nextMonth() {
  if (isCurrentMonth.value) return
  if (viewMonth.value === 11) {
    viewMonth.value = 0
    viewYear.value++
  } else {
    viewMonth.value++
  }
}

/** 回到今天 */
function goToday() {
  const now = new Date()
  viewYear.value = now.getFullYear()
  viewMonth.value = now.getMonth()
}

interface CalendarDay {
  num: number
  dateStr: string
  isToday: boolean
  hasMoment: boolean
  isFuture: boolean
  momentCount: number
}

/** 按日期聚合动态数量 */
const momentDateMap = computed(() => {
  const map = new Map<string, number>()
  props.momentDates.forEach((d) => {
    const key = d.slice(0, 10)
    map.set(key, (map.get(key) || 0) + 1)
  })
  return map
})

const calendarDays = computed<(CalendarDay | null)[]>(() => {
  const y = viewYear.value
  const m = viewMonth.value
  const firstDay = new Date(y, m, 1)
  const daysInMonth = new Date(y, m + 1, 0).getDate()

  // Monday=0 offset
  const startOffset = (firstDay.getDay() + 6) % 7
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const result: (CalendarDay | null)[] = []

  // pad leading empties
  for (let i = 0; i < startOffset; i++) {
    result.push(null)
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const isFuture = new Date(y, m, d) > today
    const momentCount = momentDateMap.value.get(dateStr) || 0
    result.push({
      num: d,
      dateStr,
      isToday: dateStr === todayStr,
      hasMoment: momentCount > 0,
      isFuture,
      momentCount,
    })
  }

  return result
})

const monthMomentCount = computed(() => {
  const prefix = `${viewYear.value}-${String(viewMonth.value + 1).padStart(2, '0')}`
  return props.momentDates.filter((d) => d.startsWith(prefix)).length
})

/** 计算最近连续发布天数 */
const streak = computed(() => {
  const sortedDates = [...new Set(props.momentDates.map((d) => d.slice(0, 10)))].sort().reverse()
  if (sortedDates.length === 0) return 0

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 从今天或最近一条动态开始往回数
  let count = 0
  const startDate = new Date(sortedDates[0])
  startDate.setHours(0, 0, 0, 0)

  // 如果最近的动态不是今天或昨天，不算连续
  const diffDays = Math.floor((today.getTime() - startDate.getTime()) / 86400000)
  if (diffDays > 1) return 0

  const dateSet = new Set(sortedDates)
  const checkDate = new Date(startDate)
  while (dateSet.has(checkDate.toISOString().slice(0, 10))) {
    count++
    checkDate.setDate(checkDate.getDate() - 1)
  }

  return count
})

/** 日期 hover tooltip 内容 */
function dayTooltip(day: CalendarDay): string {
  const m = viewMonth.value + 1
  return `${m}月${day.num}日 · ${day.momentCount}条动态`
}

/** 点击日期，切换筛选 */
function onDayClick(day: CalendarDay) {
  if (props.selectedDate === day.dateStr) {
    emit('select-date', null) // 再次点击取消筛选
  } else {
    emit('select-date', day.dateStr)
  }
}
</script>

<style lang="scss" scoped>
.moment-calendar-card {
  padding: 1.25rem;
}

.moment-calendar-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.moment-calendar-card__title {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  font-weight: 700;
}

.moment-calendar-card__nav {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.moment-calendar-card__nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: var(--text-soft);
  cursor: pointer;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    color: var(--text-main);
    background: var(--surface-2);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}

.moment-calendar-card__month {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-main);
  min-width: 5rem;
  text-align: center;
}

.moment-calendar-card__weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 0.25rem;
}

.moment-calendar-card__wd {
  text-align: center;
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--text-muted);
  padding: 0.25rem 0;
}

.moment-calendar-card__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.moment-calendar-card__day {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--text-main);
  border-radius: $radius-sm;
  cursor: default;
  transition: all 0.15s;

  &.is-empty {
    visibility: hidden;
  }

  &.is-future {
    color: var(--text-faint);
    opacity: 0.4;
  }

  &.is-today {
    font-weight: 700;
    background: var(--accent);
    color: #fff;
    border-radius: 50%;
  }

  &.has-moment:not(.is-today) {
    font-weight: 700;
    color: var(--accent);
    background: var(--accent-soft);
    border-radius: 50%;
    cursor: pointer;
  }

  &.has-moment.is-today {
    cursor: pointer;
  }

  &.is-selected {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  /* CSS tooltip */
  &[data-tooltip] {
    &:hover::after {
      content: attr(data-tooltip);
      position: absolute;
      bottom: calc(100% + 6px);
      left: 50%;
      transform: translateX(-50%);
      padding: 0.25rem 0.5rem;
      border-radius: $radius-sm;
      background: var(--surface-3);
      color: var(--text-main);
      font-size: 0.625rem;
      font-weight: 500;
      white-space: nowrap;
      pointer-events: none;
      z-index: 10;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
    }
  }

  &:hover:not(.is-empty):not(.is-future) {
    background: var(--surface-3);
    border-radius: 50%;

    &.is-today {
      background: var(--accent);
    }

    &.has-moment:not(.is-today) {
      background: var(--accent-soft);
    }
  }
}

.moment-calendar-card__dot {
  position: absolute;
  bottom: 2px;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--accent);

  .is-today & {
    background: #fff;
  }
}

.moment-calendar-card__footer {
  margin-top: 0.625rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.moment-calendar-card__today-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border: none;
  background: none;
  color: var(--accent);
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.125rem 0;
  transition: opacity 0.15s;

  &:hover {
    opacity: 0.8;
  }
}

.moment-calendar-card__footer-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-left: auto;
}

.moment-calendar-card__streak {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #f59e0b;
}

.moment-calendar-card__streak-icon {
  color: #f59e0b;
}

.moment-calendar-card__legend {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.6875rem;
  color: var(--text-muted);
}

.moment-calendar-card__legend-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
}
</style>
