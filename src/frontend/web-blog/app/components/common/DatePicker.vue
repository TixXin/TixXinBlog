<!--
  @file DatePicker.vue
  @description 通用日期选择器：替代样式无法定制的原生日期弹窗。触发框与输入框外观一致，面板含日 / 月 / 年三级视图、
               「今天」快捷与可选的日期范围；月历固定 6 行，面板尺寸不随月份变化。
               键盘：方向键逐日、PageUp/PageDown 切月（Shift 切年）、Home/End 到本周首尾、Enter 选中、Esc 关闭。
               面板默认与输入框起始边对齐（整个输入框都是触发区域），右侧或下方空间不足时换到右对齐或向上弹出。
               v-model 为本地日期 YYYY-MM-DD，clearable 时可清空为空串
-->
<template>
  <div ref="root" class="date-picker">
    <button
      :id="id"
      ref="trigger"
      type="button"
      class="input-field date-picker__trigger"
      :class="{ 'is-empty': !selected }"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-invalid="invalid"
      :aria-describedby="describedby"
      :aria-label="ariaLabel"
      :disabled="disabled"
      @click="toggle"
    >
      <span>{{ selected ? formatLong(selected) : placeholder || t('common.datePicker.choose') }}</span>
      <Icon name="lucide:calendar-days" aria-hidden="true" />
    </button>

    <Transition name="date-picker-pop">
      <div
        v-if="open"
        ref="panel"
        class="date-picker__panel"
        :class="{ 'is-above': above }"
        :style="{ left: `${offset}px` }"
        role="dialog"
        :aria-label="t('common.datePicker.dialog')"
        @keydown.esc.stop.prevent="close(true)"
        @click.prevent
      >
        <div class="date-picker__header">
          <button type="button" class="date-picker__nav" :aria-label="previousLabel" @click="shift(-1)">
            <Icon name="lucide:chevron-left" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="date-picker__title"
            :disabled="view === 'years'"
            :aria-label="t('common.datePicker.switchView')"
            @click="zoomOut"
          >
            {{ title }}
            <Icon v-if="view !== 'years'" name="lucide:chevron-down" aria-hidden="true" />
          </button>
          <button type="button" class="date-picker__nav" :aria-label="nextLabel" @click="shift(1)">
            <Icon name="lucide:chevron-right" aria-hidden="true" />
          </button>
        </div>

        <!-- 日视图：roving tabindex，只有光标所在日期可 Tab 进入 -->
        <div v-if="view === 'days'" class="date-picker__days" role="grid" :aria-label="title">
          <div class="date-picker__row" role="row">
            <span v-for="name in weekdays" :key="name" class="date-picker__weekday" role="columnheader">{{
              name
            }}</span>
          </div>
          <div v-for="(week, row) in weeks" :key="row" class="date-picker__row" role="row">
            <button
              v-for="cell in week"
              :key="cell.iso"
              type="button"
              role="gridcell"
              class="date-picker__day"
              :class="{
                'is-outside': !cell.inMonth,
                'is-today': cell.iso === todayIso,
                'is-selected': cell.iso === modelValue,
              }"
              :tabindex="cell.iso === cursorIso ? 0 : -1"
              :disabled="outOfRange(cell.iso)"
              :aria-selected="cell.iso === modelValue"
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

        <div v-else-if="view === 'months'" class="date-picker__grid">
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
        </div>

        <div v-else class="date-picker__grid">
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
        </div>

        <!-- 面板挂在可能包着 <label> 的位置：@click.prevent 阻止点击空白处被转发给触发按钮 -->
        <div class="date-picker__footer">
          <button v-if="clearable && modelValue" type="button" class="date-picker__clear" @click="clear">
            {{ t('common.datePicker.clear') }}
          </button>
          <button type="button" class="date-picker__today" :disabled="outOfRange(todayIso)" @click="pick(today)">
            {{ t('common.datePicker.today') }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { addDays, addMonths, monthGrid, parseIsoDate, toIsoDate, todayDate, weekdayColumn } from '~/utils/calendarGrid'
import type { CalendarDate } from '~/utils/calendarGrid'

const props = defineProps<{
  modelValue: string
  id?: string
  /** 可选范围，YYYY-MM-DD，含端点 */
  min?: string
  max?: string
  placeholder?: string
  invalid?: 'true'
  describedby?: string
  /** 没有可见标签包裹时的可访问名称 */
  ariaLabel?: string
  disabled?: boolean
  /** 允许清空（筛选条件与可选字段） */
  clearable?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; change: [value: string] }>()
const { t, locale } = useI18n()

const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const open = ref(false)
const above = ref(false)
/** 面板相对输入框起始边的水平偏移（px） */
const offset = ref(0)
const view = ref<'days' | 'months' | 'years'>('days')
const today = todayDate()
const todayIso = toIsoDate(today)
const selected = computed(() => parseIsoDate(props.modelValue))
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
const previousLabel = computed(() =>
  t(`common.datePicker.${{ days: 'previousMonth', months: 'previousYear', years: 'previousYears' }[view.value]}`),
)
const nextLabel = computed(() =>
  t(`common.datePicker.${{ days: 'nextMonth', months: 'nextYear', years: 'nextYears' }[view.value]}`),
)

function formatLong(date: CalendarDate) {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'long' }).format(new Date(date.year, date.month, date.day))
}
function outOfRange(iso: string) {
  return (!!props.min && iso < props.min) || (!!props.max && iso > props.max)
}

/**
 * 面板约 18.5rem × 22rem。纵向：下方空间不足且上方足够时向上弹出。
 * 横向：默认与输入框起始边对齐；右侧放不下时改为与输入框右缘对齐；仍放不下（窄屏）时贴视口边缘留出安全间距
 */
const PANEL = { width: 296, height: 360, margin: 8 }
function place() {
  const rect = trigger.value?.getBoundingClientRect()
  if (!rect) return
  above.value = window.innerHeight - rect.bottom < PANEL.height && rect.top > PANEL.height
  const limit = window.innerWidth - PANEL.margin
  let left = 0
  if (rect.left + PANEL.width > limit) left = rect.width - PANEL.width
  if (rect.left + left < PANEL.margin) left = PANEL.margin - rect.left
  if (rect.left + left + PANEL.width > limit) left = Math.max(PANEL.margin - rect.left, limit - PANEL.width - rect.left)
  offset.value = Math.round(left)
}
async function focusCursor() {
  await nextTick()
  panel.value?.querySelector<HTMLElement>(`[data-iso="${cursorIso.value}"]`)?.focus()
}
async function openPanel() {
  cursor.value = selected.value ?? today
  view.value = 'days'
  place()
  open.value = true
  await focusCursor()
}
function close(returnFocus = false) {
  open.value = false
  if (returnFocus) trigger.value?.focus()
}
function toggle() {
  if (open.value) close()
  else void openPanel()
}
function commit(value: string) {
  emit('update:modelValue', value)
  emit('change', value)
  close(true)
}
function pick(date: CalendarDate) {
  const iso = toIsoDate(date)
  if (!outOfRange(iso)) commit(iso)
}
function clear() {
  commit('')
}

function shift(direction: 1 | -1) {
  if (view.value === 'days') cursor.value = addMonths(cursor.value, direction)
  else if (view.value === 'months') cursor.value = addMonths(cursor.value, direction * 12)
  else cursor.value = addMonths(cursor.value, direction * 144)
}
function zoomOut() {
  view.value = view.value === 'days' ? 'months' : 'years'
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

// 点击面板外部关闭
function onPointerDown(event: PointerEvent) {
  if (open.value && root.value && !root.value.contains(event.target as Node)) close()
}
onMounted(() => document.addEventListener('pointerdown', onPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))
</script>

<style scoped lang="scss">
.date-picker {
  position: relative;
}
.date-picker__trigger {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
  min-height: 2.75rem;
  border-color: var(--border);
  border-radius: $radius-md;
  padding: 0.5rem 0.875rem;
  text-align: left;
  cursor: pointer;

  svg,
  .iconify {
    flex-shrink: 0;
    color: var(--text-muted);
  }
  &.is-empty span {
    color: var(--text-soft);
  }
  &[aria-expanded='true'] {
    border-color: var(--border-hover);
    box-shadow: 0 0 0 4px var(--accent-soft);
  }
  &[aria-invalid='true'] {
    border-color: var(--danger);
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}
.date-picker__panel {
  position: absolute;
  top: calc(100% + 0.375rem);
  left: 0;
  z-index: 30;
  width: 18.5rem;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: $radius-lg;
  background: var(--surface-1);
  box-shadow:
    var(--shadow-card),
    0 12px 32px rgba(0, 0, 0, 0.12);

  &.is-above {
    top: auto;
    bottom: calc(100% + 0.375rem);
  }
}
.date-picker__header {
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
.date-picker__days {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}
.date-picker__row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.125rem;
}
.date-picker__weekday {
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
.date-picker__grid {
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
.date-picker__footer {
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
.date-picker-pop-enter-active,
.date-picker-pop-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}
.date-picker-pop-enter-from,
.date-picker-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
