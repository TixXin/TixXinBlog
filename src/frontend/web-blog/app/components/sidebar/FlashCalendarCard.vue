<!--
  @file FlashCalendarCard.vue
  @description 闪念右侧栏发布日历卡，按月展示发布日期，支持点击日期筛选；与 MomentCalendarCard 同款交互
  @author TixXin
  @since 2026-04-17
-->

<template>
  <section class="card flash-calendar-card">
    <div class="flash-calendar-card__header">
      <h3 class="flash-calendar-card__title">
        <Icon name="lucide:calendar-days" size="16" />
        发布日历
      </h3>
      <div class="flash-calendar-card__nav">
        <button type="button" class="flash-calendar-card__nav-btn" aria-label="上一月" @click="prevMonth">
          <Icon name="lucide:chevron-left" size="14" />
        </button>
        <span class="flash-calendar-card__month">{{ monthLabel }}</span>
        <button
          type="button"
          class="flash-calendar-card__nav-btn"
          :disabled="isCurrentMonth"
          aria-label="下一月"
          @click="nextMonth"
        >
          <Icon name="lucide:chevron-right" size="14" />
        </button>
      </div>
    </div>

    <div class="flash-calendar-card__weekdays">
      <span v-for="wd in weekdays" :key="wd" class="flash-calendar-card__wd">{{ wd }}</span>
    </div>

    <div class="flash-calendar-card__grid">
      <span
        v-for="(day, idx) in calendarDays"
        :key="idx"
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
      </span>
    </div>

    <div class="flash-calendar-card__footer">
      <button
        v-if="!isCurrentMonth"
        type="button"
        class="flash-calendar-card__today-btn"
        @click="goToday"
      >
        <Icon name="lucide:calendar-check" size="12" />
        今天
      </button>

      <div class="flash-calendar-card__footer-right">
        <span v-if="streak > 0" class="flash-calendar-card__streak">
          <Icon name="lucide:flame" size="12" class="flash-calendar-card__streak-icon" />
          连续 {{ streak }} 天
        </span>
        <span class="flash-calendar-card__legend">
          <span class="flash-calendar-card__legend-dot" />
          本月 {{ monthNoteCount }} 条
        </span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{
  noteDates: string[] // ISO 日期字符串数组（前 10 字符即可）
  selectedDate?: string | null
}>()

const emit = defineEmits<{
  'select-date': [date: string | null]
}>()

const weekdays = ['一', '二', '三', '四', '五', '六', '日']

const viewYear = ref(new Date().getFullYear())
const viewMonth = ref(new Date().getMonth())

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

function goToday() {
  const now = new Date()
  viewYear.value = now.getFullYear()
  viewMonth.value = now.getMonth()
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
  props.noteDates.forEach((d) => {
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

  const startOffset = (firstDay.getDay() + 6) % 7
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const result: (CalendarDay | null)[] = []
  for (let i = 0; i < startOffset; i++) result.push(null)

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const isFuture = new Date(y, m, d) > today
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
  return props.noteDates.filter((d) => d.startsWith(prefix)).length
})

const streak = computed(() => {
  const sortedDates = [...new Set(props.noteDates.map((d) => d.slice(0, 10)))].sort().reverse()
  if (sortedDates.length === 0) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let count = 0
  const startDate = new Date(sortedDates[0]!)
  startDate.setHours(0, 0, 0, 0)
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

function dayTooltip(day: CalendarDay): string {
  const m = viewMonth.value + 1
  return `${m}月${day.num}日 · ${day.noteCount}条`
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

  &.has-note:not(.is-today) {
    font-weight: 700;
    color: var(--accent);
    background: var(--accent-soft);
    border-radius: 50%;
    cursor: pointer;
  }

  &.has-note.is-today {
    cursor: pointer;
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
  color: #f59e0b;
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
