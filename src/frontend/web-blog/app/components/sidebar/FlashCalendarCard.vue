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
import {
  type CalendarDay,
  buildNoteDateMap,
  buildCalendarDays,
  calculateMonthNoteCount,
  calculateFlashStreak,
} from '~/features/flash/calendar'
import { useFlashCalendarNav } from '~/features/flash/useFlashCalendarNav'

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

const { viewYear, viewMonth, monthLabel, isCurrentMonth, prevMonth, nextMonth, goToday } = useFlashCalendarNav(
  toRef(props, 'selectedDate'),
)

const noteDateMap = computed(() => buildNoteDateMap(props.dates))

const calendarDays = computed<(CalendarDay | null)[]>(() =>
  buildCalendarDays(viewYear.value, viewMonth.value, noteDateMap.value),
)

const monthNoteCount = computed(() => calculateMonthNoteCount(props.dates, viewYear.value, viewMonth.value))

const streak = computed(() => calculateFlashStreak(noteDateMap.value))

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
