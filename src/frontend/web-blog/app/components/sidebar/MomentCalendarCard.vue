<!--
  @file MomentCalendarCard.vue
  @description 朋友圈右侧栏动态日历卡，按月展示发布日期标记
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
        }"
      >
        <template v-if="day">
          {{ day.num }}
          <span v-if="day.hasMoment" class="moment-calendar-card__dot" />
        </template>
      </span>
    </div>

    <div class="moment-calendar-card__footer">
      <span class="moment-calendar-card__legend">
        <span class="moment-calendar-card__legend-dot" />
        本月 {{ monthMomentCount }} 条动态
      </span>
    </div>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{
  momentDates: string[] // ISO 日期字符串数组, e.g. ['2026-04-04', '2026-04-03']
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

interface CalendarDay {
  num: number
  isToday: boolean
  hasMoment: boolean
  isFuture: boolean
}

const momentDateSet = computed(() => {
  const set = new Set<string>()
  props.momentDates.forEach((d) => {
    set.add(d.slice(0, 10)) // normalize to YYYY-MM-DD
  })
  return set
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
    result.push({
      num: d,
      isToday: dateStr === todayStr,
      hasMoment: momentDateSet.value.has(dateStr),
      isFuture,
    })
  }

  return result
})

const monthMomentCount = computed(() => {
  const prefix = `${viewYear.value}-${String(viewMonth.value + 1).padStart(2, '0')}`
  return props.momentDates.filter((d) => d.startsWith(prefix)).length
})
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
  }

  &:hover:not(.is-empty):not(.is-future) {
    background: var(--surface-3);
    border-radius: 50%;

    &.is-today {
      background: var(--accent);
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
  justify-content: flex-end;
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
