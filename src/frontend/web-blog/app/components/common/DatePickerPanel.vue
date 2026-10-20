<!--
  @file DatePickerPanel.vue
  @description 日期选择器的面板：日 / 月 / 年三级视图，月历固定 6 行；「今天」「清除」快捷与可选范围。
               键盘：方向键逐日、PageUp/PageDown 切月（Shift 切年）、Home/End 到本周首尾，roving tabindex。
               只负责浏览与选择，弹出、定位与关闭由 CommonDatePicker 负责
-->
<template>
  <div ref="root" class="date-picker-panel" role="dialog" :aria-label="t('common.datePicker.dialog')">
    <div class="date-picker-panel__header">
      <button type="button" class="date-picker__nav" :aria-label="navLabel(-1)" @click="shift(-1)">
        <Icon name="lucide:chevron-left" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="date-picker__title"
        :disabled="view === 'years'"
        :aria-label="t('common.datePicker.switchView')"
        @click="view = view === 'days' ? 'months' : 'years'"
      >
        {{ title }}
        <Icon v-if="view !== 'years'" name="lucide:chevron-down" aria-hidden="true" />
      </button>
      <button type="button" class="date-picker__nav" :aria-label="navLabel(1)" @click="shift(1)">
        <Icon name="lucide:chevron-right" aria-hidden="true" />
      </button>
    </div>

    <div v-if="view === 'days'" class="date-picker-panel__days" role="grid" :aria-label="title">
      <div class="date-picker-panel__row" role="row">
        <span v-for="name in weekdays" :key="name" class="date-picker-panel__weekday" role="columnheader">{{
          name
        }}</span>
      </div>
      <div v-for="(week, row) in weeks" :key="row" class="date-picker-panel__row" role="row">
        <button
          v-for="cell in week"
          :key="cell.iso"
          type="button"
          role="gridcell"
          class="date-picker__day"
          :class="{ 'is-outside': !cell.inMonth, 'is-today': cell.iso === todayIso, 'is-selected': cell.iso === value }"
          :tabindex="cell.iso === cursorIso ? 0 : -1"
          :disabled="outOfRange(cell.iso)"
          :aria-selected="cell.iso === value"
          :aria-current="cell.iso === todayIso ? 'date' : undefined"
          :aria-label="formatLong(cell)"
          :data-iso="cell.iso"
          @click="pick(cell)"
          @keydown="onDayKey($event, cell)"
        >
          {{ cell.day }}
        </button>
      </div>
    </div>
    <div v-else class="date-picker-panel__grid">
      <template v-if="view === 'months'">
        <button
          v-for="(name, month) in monthNames"
          :key="name"
          type="button"
          class="date-picker__cell"
          :class="{ 'is-selected': selected?.year === cursor.year && selected?.month === month }"
          @click="chooseMonth(month)"
        >
          {{ name }}
        </button>
      </template>
      <template v-else>
        <button
          v-for="year in years"
          :key="year"
          type="button"
          class="date-picker__cell"
          :class="{ 'is-selected': selected?.year === year, 'is-today': year === today.year }"
          @click="chooseYear(year)"
        >
          {{ year }}
        </button>
      </template>
    </div>

    <div class="date-picker-panel__footer">
      <button v-if="clearable && value" type="button" class="date-picker__clear" @click="emit('select', '')">
        {{ t('common.datePicker.clear') }}
      </button>
      <button type="button" class="date-picker__today" :disabled="outOfRange(todayIso)" @click="pick(today)">
        {{ t('common.datePicker.today') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { addDays, addMonths, monthGrid, parseIsoDate, toIsoDate, todayDate, weekdayColumn } from '~/utils/calendarGrid'
import type { CalendarDate } from '~/utils/calendarGrid'

const props = defineProps<{
  /** 已选日期 YYYY-MM-DD，空串表示未选 */
  value: string
  min?: string
  max?: string
  clearable?: boolean
}>()
const emit = defineEmits<{ select: [value: string] }>()
const { t, locale } = useI18n()

const root = useTemplateRef<HTMLElement>('root')
const view = ref<'days' | 'months' | 'years'>('days')
const today = todayDate()
const todayIso = toIsoDate(today)
const selected = computed(() => parseIsoDate(props.value))
const cursor = ref<CalendarDate>(selected.value ?? today)
const cursorIso = computed(() => toIsoDate(cursor.value))

// 中文习惯周一开头，英文周日开头
const weekStart = computed<0 | 1>(() => (locale.value === 'en' ? 0 : 1))
const weeks = computed(() => {
  const cells = monthGrid(cursor.value.year, cursor.value.month, weekStart.value)
  return Array.from({ length: 6 }, (_, row) => cells.slice(row * 7, row * 7 + 7))
})
const weekdays = computed(() => {
  const format = new Intl.DateTimeFormat(locale.value, { weekday: 'narrow' })
  // 2023-01-01 为周日
  return Array.from({ length: 7 }, (_, index) => format.format(new Date(2023, 0, 1 + weekStart.value + index)))
})
const monthNames = computed(() => {
  const format = new Intl.DateTimeFormat(locale.value, { month: 'short' })
  return Array.from({ length: 12 }, (_, month) => format.format(new Date(2023, month, 1)))
})
const yearStart = computed(() => Math.floor(cursor.value.year / 12) * 12)
const years = computed(() => Array.from({ length: 12 }, (_, index) => yearStart.value + index))
const title = computed(() => {
  if (view.value === 'years') return `${yearStart.value} – ${yearStart.value + 11}`
  const date = new Date(cursor.value.year, cursor.value.month, 1)
  return view.value === 'months'
    ? new Intl.DateTimeFormat(locale.value, { year: 'numeric' }).format(date)
    : new Intl.DateTimeFormat(locale.value, { year: 'numeric', month: 'long' }).format(date)
})

function navLabel(direction: 1 | -1) {
  const key = { days: 'Month', months: 'Year', years: 'Years' }[view.value]
  return t(`common.datePicker.${direction < 0 ? 'previous' : 'next'}${key}`)
}
function formatLong(date: CalendarDate) {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'long' }).format(new Date(date.year, date.month, date.day))
}
function outOfRange(iso: string) {
  return (!!props.min && iso < props.min) || (!!props.max && iso > props.max)
}
function pick(date: CalendarDate) {
  const iso = toIsoDate(date)
  if (!outOfRange(iso)) emit('select', iso)
}
function shift(direction: 1 | -1) {
  const months = { days: 1, months: 12, years: 144 }[view.value]
  cursor.value = addMonths(cursor.value, direction * months)
}
function chooseYear(year: number) {
  cursor.value = addMonths(cursor.value, (year - cursor.value.year) * 12)
  view.value = 'months'
}
async function chooseMonth(month: number) {
  cursor.value = addMonths(cursor.value, month - cursor.value.month)
  view.value = 'days'
  await focusCursor()
}

/** 把键盘焦点交给光标所在日期 */
async function focusCursor() {
  await nextTick()
  root.value?.querySelector<HTMLElement>(`[data-iso="${cursorIso.value}"]`)?.focus()
}
/** 手动输入合法日期时让面板跟随（不移动焦点） */
function reveal(date: CalendarDate) {
  cursor.value = date
  view.value = 'days'
}

function onDayKey(event: KeyboardEvent, cell: CalendarDate) {
  const moves: Record<string, () => CalendarDate> = {
    ArrowLeft: () => addDays(cell, -1),
    ArrowRight: () => addDays(cell, 1),
    ArrowUp: () => addDays(cell, -7),
    ArrowDown: () => addDays(cell, 7),
    PageUp: () => addMonths(cell, event.shiftKey ? -12 : -1),
    PageDown: () => addMonths(cell, event.shiftKey ? 12 : 1),
    Home: () => addDays(cell, -weekdayColumn(cell, weekStart.value)),
    End: () => addDays(cell, 6 - weekdayColumn(cell, weekStart.value)),
  }
  const move = moves[event.key]
  if (!move) return
  event.preventDefault()
  cursor.value = move()
  void focusCursor()
}

defineExpose({ focusCursor, reveal })
</script>

<style scoped lang="scss">
.date-picker-panel__header {
  display: flex;
  gap: 0.25rem;
  align-items: center;
  margin-bottom: 0.5rem;
}
.date-picker__nav,
.date-picker__title,
.date-picker__day,
.date-picker__cell,
.date-picker__clear,
.date-picker__today {
  border: 0;
  background: none;
  color: var(--text-main);
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--hover);
  }
  &:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }
}
.date-picker__nav {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: $radius-sm;
  color: var(--text-muted);
}
.date-picker__title {
  display: inline-flex;
  flex: 1;
  gap: 0.25rem;
  align-items: center;
  justify-content: center;
  height: 2rem;
  border-radius: $radius-sm;
  font-size: 0.875rem;
  font-weight: 600;

  &:disabled {
    cursor: default;
  }
  svg,
  .iconify {
    color: var(--text-soft);
    font-size: 0.875rem;
  }
}
.date-picker-panel__days {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}
.date-picker-panel__row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.125rem;
}
.date-picker-panel__weekday {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 1.75rem;
  color: var(--text-soft);
  font-size: 0.75rem;
}
.date-picker__day {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 2.25rem;
  border-radius: $radius-sm;
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;

  &.is-outside {
    color: var(--text-soft);
  }
  &.is-today {
    box-shadow: inset 0 0 0 1px var(--border-hover);
    font-weight: 600;
  }
  &.is-selected,
  &.is-selected:hover {
    background: var(--text-main);
    color: var(--bg);
    font-weight: 600;
  }
  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
}
// 月份与年份：3 列 × 4 行，与日视图高度接近
.date-picker-panel__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.375rem;
  min-height: 15.5rem;
  align-content: center;
}
.date-picker__cell {
  height: 3.25rem;
  border-radius: $radius-md;
  font-size: 0.875rem;

  &.is-today {
    box-shadow: inset 0 0 0 1px var(--border-hover);
  }
  &.is-selected,
  &.is-selected:hover {
    background: var(--text-main);
    color: var(--bg);
    font-weight: 600;
  }
}
.date-picker-panel__footer {
  display: flex;
  justify-content: space-between;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-soft);
}
.date-picker__today {
  margin-left: auto;
  padding: 0.375rem 0.75rem;
  border-radius: $radius-sm;
  color: var(--accent);
  font-size: 0.8125rem;
  font-weight: 600;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}
.date-picker__clear {
  padding: 0.375rem 0.75rem;
  border-radius: $radius-sm;
  color: var(--text-muted);
  font-size: 0.8125rem;
}
</style>
