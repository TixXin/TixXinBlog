<!--
  @file MomentCalendarCard.vue
  @description 朋友圈右侧栏动态日历卡，按月展示发布日期标记，支持点击日期筛选
  @author TixXin
  @since 2026-04-07
-->

<template>
  <section class="card moment-calendar-card">
    <div class="moment-calendar-card__header">
      <h2 class="moment-calendar-card__title">
        <Icon name="lucide:calendar-days" size="16" />
        {{ $t('layout.sidebar.calendar.momentTitle') }}
      </h2>
      <div class="moment-calendar-card__nav">
        <button
          type="button"
          class="moment-calendar-card__nav-btn"
          :aria-label="$t('layout.sidebar.calendar.prevMonth')"
          @click="prevMonth"
        >
          <Icon name="lucide:chevron-left" size="14" />
        </button>
        <span class="moment-calendar-card__month">{{ monthLabel }}</span>
        <button
          type="button"
          class="moment-calendar-card__nav-btn"
          :disabled="isCurrentMonth"
          :aria-label="$t('layout.sidebar.calendar.nextMonth')"
          @click="nextMonth"
        >
          <Icon name="lucide:chevron-right" size="14" />
        </button>
      </div>
    </div>

    <div class="moment-calendar-card__weekdays">
      <span v-for="(wd, index) in weekdays" :key="index" class="moment-calendar-card__wd">{{ wd }}</span>
    </div>

    <div class="moment-calendar-card__grid">
      <button
        v-for="(day, idx) in calendarDays"
        :key="idx"
        type="button"
        :disabled="!day?.hasMoment"
        :aria-hidden="!day || undefined"
        :aria-label="
          day
            ? $t('layout.sidebar.calendar.momentDayLabel', { date: dayLabel(day.dateStr), count: day.momentCount })
            : undefined
        "
        :aria-pressed="day?.dateStr === selectedDate"
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
      </button>
    </div>

    <div class="moment-calendar-card__footer">
      <!-- 回到今天按钮 -->
      <button v-if="!isCurrentMonth" type="button" class="moment-calendar-card__today-btn" @click="goToday">
        <Icon name="lucide:calendar-check" size="12" />
        {{ $t('layout.sidebar.calendar.today') }}
      </button>

      <div class="moment-calendar-card__footer-right">
        <!-- 连续发布天数 -->
        <span v-if="streak > 0" class="moment-calendar-card__streak">
          <Icon name="lucide:flame" size="12" class="moment-calendar-card__streak-icon" />
          {{ $t('layout.sidebar.calendar.streak', { count: streak }) }}
        </span>
        <span class="moment-calendar-card__legend">
          <span class="moment-calendar-card__legend-dot" />
          {{
            $t(
              'layout.sidebar.calendar.momentMonthCount',
              { count: available ? monthMomentCount : '—' },
              available ? monthMomentCount : 2,
            )
          }}
        </span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useMomentCalendar, type MomentCalendarProps } from '~/features/moment/useMomentCalendar'

const props = withDefaults(defineProps<MomentCalendarProps>(), {
  momentDates: () => [],
  available: true,
  dateCounts: undefined,
  selectedDate: null,
})

const emit = defineEmits<{
  'select-date': [date: string | null]
}>()

const {
  weekdays,
  monthLabel,
  isCurrentMonth,
  calendarDays,
  monthMomentCount,
  streak,
  prevMonth,
  nextMonth,
  goToday,
  dayLabel,
  dayTooltip,
  onDayClick,
} = useMomentCalendar(props, (event, date) => emit(event, date))
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

  &.has-moment:not(.is-today) {
    font-weight: 700;
    color: var(--accent-text);
    background: var(--accent-soft);
    border-radius: 50%;
    cursor: var(--interaction-cursor, pointer);
  }

  &.has-moment.is-today {
    cursor: var(--interaction-cursor, pointer);
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
  color: var(--warning-text);
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
