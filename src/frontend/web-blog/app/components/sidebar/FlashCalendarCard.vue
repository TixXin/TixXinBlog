<!--
  @file FlashCalendarCard.vue
  @description 闪念右侧栏发布日历卡，按月展示发布日期，支持点击日期筛选；与 MomentCalendarCard 同款交互
  @author TixXin
  @since 2026-04-17
-->

<template>
  <section class="card flash-calendar-card">
    <div class="flash-calendar-card__header">
      <h2 class="flash-calendar-card__title">
        <Icon name="lucide:calendar-days" size="16" />
        {{ $t('layout.sidebar.calendar.flashTitle') }}
      </h2>
      <div class="flash-calendar-card__nav">
        <button
          type="button"
          class="flash-calendar-card__nav-btn"
          :aria-label="$t('layout.sidebar.calendar.prevMonth')"
          @click="prevMonth"
        >
          <Icon name="lucide:chevron-left" size="14" />
        </button>
        <span class="flash-calendar-card__month">{{ monthLabel }}</span>
        <button
          type="button"
          class="flash-calendar-card__nav-btn"
          :disabled="isCurrentMonth"
          :aria-label="$t('layout.sidebar.calendar.nextMonth')"
          @click="nextMonth"
        >
          <Icon name="lucide:chevron-right" size="14" />
        </button>
      </div>
    </div>

    <div class="flash-calendar-card__weekdays">
      <span v-for="(wd, index) in weekdays" :key="index" class="flash-calendar-card__wd">{{ wd }}</span>
    </div>

    <div class="flash-calendar-card__grid">
      <button
        v-for="(day, idx) in calendarDays"
        :key="idx"
        type="button"
        :disabled="!day?.hasNote"
        :aria-hidden="!day || undefined"
        :aria-label="
          day
            ? $t('layout.sidebar.calendar.flashDayLabel', { date: dayLabel(day.dateStr), count: day.noteCount })
            : undefined
        "
        :aria-pressed="day?.dateStr === selectedDate"
        class="flash-calendar-card__day"
        :class="{
          'is-empty': !day,
          'is-today': day?.isToday,
          'has-note': day?.hasNote,
          'is-future': day?.isFuture,
          'is-selected': day?.dateStr === selectedDate,
        }"
        :data-tooltip="day?.hasNote ? dayTooltip(day) : undefined"
        @click="day?.hasNote && onDayClick(day)"
      >
        <template v-if="day">
          {{ day.num }}
          <span v-if="day.hasNote" class="flash-calendar-card__dot" />
        </template>
      </button>
    </div>

    <div class="flash-calendar-card__footer">
      <button v-if="!isCurrentMonth" type="button" class="flash-calendar-card__today-btn" @click="goToday">
        <Icon name="lucide:calendar-check" size="12" />
        {{ $t('layout.sidebar.calendar.today') }}
      </button>

      <div class="flash-calendar-card__footer-right">
        <span v-if="streak > 0" class="flash-calendar-card__streak">
          <Icon name="lucide:flame" size="12" class="flash-calendar-card__streak-icon" />
          {{ $t('layout.sidebar.calendar.streak', { count: streak }) }}
        </span>
        <span class="flash-calendar-card__legend">
          <span class="flash-calendar-card__legend-dot" />
          {{ $t('layout.sidebar.calendar.flashMonthCount', { count: monthNoteCount }) }}
        </span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{
  /** 有闪念的 UTC 日期与条数（来自闪念概览），可覆盖任意历史月份 */
  dates: { date: string; count: number }[]
  selectedDate?: string | null
}>()

const emit = defineEmits<{
  'select-date': [date: string | null]
}>()

const { t } = useI18n()
// 星期表头从周一开始
const weekdays = computed(() =>
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => t(`layout.sidebar.calendar.weekdays.${day}`)),
)

/** 日期按钮的读屏名称；日数不补零，保证可见的日数是可访问名的一部分 */
function dayLabel(dateStr: string) {
  const [year = 0, month = 1, day = 1] = dateStr.split('-').map(Number)
  return formatDate(Date.UTC(year, month - 1, day), { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' })
}

// 闪念日期按 createdAt 的 UTC 日期分组，日历的“今天”、月份与星期也统一用 UTC，与动态日历一致
const viewYear = ref(new Date().getUTCFullYear())
const viewMonth = ref(new Date().getUTCMonth())

// 与动态日历一致：切换侧栏或抽屉后，从共享筛选恢复已选日期所在月份。
watch(
  () => props.selectedDate,
  (value) => {
    if (!value) return
    const date = new Date(`${value}T12:00:00Z`)
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return
    viewYear.value = date.getUTCFullYear()
    viewMonth.value = date.getUTCMonth()
  },
  { immediate: true },
)

const monthLabel = computed(() =>
  formatDate(Date.UTC(viewYear.value, viewMonth.value, 1), { timeZone: 'UTC', year: 'numeric', month: 'short' }),
)

const isCurrentMonth = computed(() => {
  const now = new Date()
  return viewYear.value === now.getUTCFullYear() && viewMonth.value === now.getUTCMonth()
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

function goToday() {
  const now = new Date()
  viewYear.value = now.getUTCFullYear()
  viewMonth.value = now.getUTCMonth()
}

interface CalendarDay {
  num: number
  dateStr: string
  isToday: boolean
  hasNote: boolean
  isFuture: boolean
  noteCount: number
}

const noteDateMap = computed(() => {
  const map = new Map<string, number>()
  props.dates.forEach(({ date, count }) => {
    const key = date.slice(0, 10)
    map.set(key, (map.get(key) || 0) + count)
  })
  return map
})

const calendarDays = computed<(CalendarDay | null)[]>(() => {
  const y = viewYear.value
  const m = viewMonth.value
  const firstDay = new Date(Date.UTC(y, m, 1))
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()

  const startOffset = (firstDay.getUTCDay() + 6) % 7
  const todayStr = new Date().toISOString().slice(0, 10)

  const result: (CalendarDay | null)[] = []
  for (let i = 0; i < startOffset; i++) result.push(null)

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const isFuture = dateStr > todayStr
    const noteCount = noteDateMap.value.get(dateStr) || 0
    result.push({
      num: d,
      dateStr,
      isToday: dateStr === todayStr,
      hasNote: noteCount > 0,
      isFuture,
      noteCount,
    })
  }

  return result
})

const monthNoteCount = computed(() => {
  const prefix = `${viewYear.value}-${String(viewMonth.value + 1).padStart(2, '0')}`
  return props.dates.reduce((sum, { date, count }) => (date.startsWith(prefix) ? sum + count : sum), 0)
})

const streak = computed(() => {
  const sortedDates = [...noteDateMap.value.keys()].sort().reverse()
  if (sortedDates.length === 0) return 0
  // 全程 UTC：本地 setHours 与 toISOString 混用会在东八区等时区错位一天
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  let count = 0
  const startDate = new Date(`${sortedDates[0]!}T00:00:00Z`)
  const diffDays = Math.floor((today.getTime() - startDate.getTime()) / 86400000)
  if (diffDays > 1) return 0

  const dateSet = new Set(sortedDates)
  const checkDate = new Date(startDate)
  while (dateSet.has(checkDate.toISOString().slice(0, 10))) {
    count++
    checkDate.setUTCDate(checkDate.getUTCDate() - 1)
  }
  return count
})

/** 当前视图月份中某天的月日文字，如「10月19日」 */
function monthDay(num: number) {
  return formatDate(Date.UTC(viewYear.value, viewMonth.value, num), { timeZone: 'UTC', month: 'short', day: 'numeric' })
}

function dayTooltip(day: CalendarDay): string {
  return t('layout.sidebar.calendar.flashTooltip', { date: monthDay(day.num), count: day.noteCount })
}

function onDayClick(day: CalendarDay) {
  if (props.selectedDate === day.dateStr) {
    emit('select-date', null)
  } else {
    emit('select-date', day.dateStr)
  }
}
</script>

<style lang="scss" scoped>
.flash-calendar-card {
  padding: 1.25rem;
}

.flash-calendar-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.flash-calendar-card__title {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  font-weight: 700;
  margin: 0;
}

.flash-calendar-card__nav {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.flash-calendar-card__nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: var(--text-soft);
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover:not(:disabled) {
    color: var(--text-main);
    background: var(--surface-2);
  }

  &:disabled {
    opacity: 0.3;
    cursor: var(--interaction-cursor, not-allowed);
  }
}

.flash-calendar-card__month {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-main);
  min-width: 5rem;
  text-align: center;
}

.flash-calendar-card__weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 0.25rem;
}

.flash-calendar-card__wd {
  text-align: center;
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--text-muted);
  padding: 0.25rem 0;
}

.flash-calendar-card__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.flash-calendar-card__day {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--text-main);
  border-radius: $radius-sm;
  cursor: var(--interaction-cursor, default);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &.is-empty {
    visibility: hidden;
  }

  &.is-future {
    color: var(--text-faint);
    opacity: 0.4;
  }

  &.is-today {
    font-weight: 700;
    background: var(--accent-action);
    color: #fff;
    border-radius: 50%;
  }

  &.has-note:not(.is-today) {
    font-weight: 700;
    color: var(--accent-text);
    background: var(--accent-soft);
    border-radius: 50%;
    cursor: var(--interaction-cursor, pointer);
  }

  &.has-note.is-today {
    cursor: var(--interaction-cursor, pointer);
  }

  &.is-selected {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

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

    &.has-note:not(.is-today) {
      background: var(--accent-soft);
    }
  }
}

.flash-calendar-card__dot {
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

.flash-calendar-card__footer {
  margin-top: 0.625rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.flash-calendar-card__today-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border: none;
  background: none;
  color: var(--accent-text);
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: var(--interaction-cursor, pointer);
  padding: 0.125rem 0;
  transition: opacity 0.15s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    opacity: 0.8;
  }
}

.flash-calendar-card__footer-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-left: auto;
}

.flash-calendar-card__streak {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--warning-text);
}

.flash-calendar-card__streak-icon {
  color: #f59e0b;
}

.flash-calendar-card__legend {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.6875rem;
  color: var(--text-muted);
}

.flash-calendar-card__legend-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
}
</style>
