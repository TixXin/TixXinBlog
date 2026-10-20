<!--
  @file DatePicker.vue
  @description 通用日期选择器（替代样式无法定制的原生日期弹窗）：可手动输入的组合框 + 日期面板。
               未聚焦时显示本地化长日期，聚焦时切换为 YYYY-MM-DD 便于编辑；回车或失焦确认输入，
               接受 2019-03-15、2019/3/15、20190315 等写法，非法或超出范围时恢复原值并标为无效。
               点输入框打开面板且焦点留在输入框，↓ 或日历按钮把焦点交给面板。面板默认与输入框起始边对齐，
               右侧放不下时与右缘对齐，仍放不下时贴视口边缘；下方不足时向上弹出。v-model 为 YYYY-MM-DD
-->
<template>
  <div ref="root" class="date-picker">
    <div
      class="input-field date-picker__field"
      :class="{ 'is-open': open, 'is-invalid': invalid === 'true' || typedInvalid, 'is-disabled': disabled }"
    >
      <input
        :id="id"
        ref="input"
        class="date-picker__input"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        spellcheck="false"
        role="combobox"
        aria-haspopup="dialog"
        :aria-expanded="open"
        :aria-controls="open ? panelId : undefined"
        :aria-invalid="invalid ?? (typedInvalid ? 'true' : undefined)"
        :aria-describedby="describedby"
        :aria-label="ariaLabel"
        :disabled="disabled"
        :placeholder="focused ? 'YYYY-MM-DD' : placeholder || t('common.datePicker.choose')"
        :value="text"
        @focus="onFocus"
        @blur="onBlur"
        @input="onInput"
        @keydown="onKeydown"
        @click="openPanel(false)"
      />
      <button
        type="button"
        class="date-picker__toggle"
        :aria-label="t('common.datePicker.open')"
        :disabled="disabled"
        @click="toggle"
      >
        <Icon name="lucide:calendar-days" aria-hidden="true" />
      </button>
    </div>

    <Transition name="date-picker-pop">
      <!-- 可能被 <label> 包裹：@click.prevent 阻止点击面板空白处被转发给输入框 -->
      <div
        v-if="open"
        :id="panelId"
        class="date-picker__popover"
        :class="{ 'is-above': above }"
        :style="{ left: `${offset}px` }"
        @keydown.esc.stop.prevent="close(true)"
        @click.prevent
      >
        <CommonDatePickerPanel
          ref="panel"
          :value="modelValue"
          :min="min"
          :max="max"
          :clearable="clearable"
          @select="pick"
        />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { parseIsoDate, parseTypedDate, toIsoDate } from '~/utils/calendarGrid'
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

const root = useTemplateRef<HTMLElement>('root')
const input = useTemplateRef<HTMLInputElement>('input')
const panel = useTemplateRef<{ focusCursor: () => Promise<void>; reveal: (date: CalendarDate) => void }>('panel')
const panelId = useId()
const open = ref(false)
const above = ref(false)
/** 面板相对输入框起始边的水平偏移（px） */
const offset = ref(0)
const focused = ref(false)
const draft = ref('')
const typedInvalid = ref(false)

const text = computed(() => {
  if (focused.value) return draft.value
  const date = parseIsoDate(props.modelValue)
  return date
    ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'long' }).format(new Date(date.year, date.month, date.day))
    : ''
})

function outOfRange(iso: string) {
  return (!!props.min && iso < props.min) || (!!props.max && iso > props.max)
}

/** 面板约 18.5rem × 22rem：纵向不足时向上；横向默认起始边对齐，放不下时右对齐，仍放不下时贴视口边缘 */
const PANEL = { width: 296, height: 360, margin: 8 }
function place() {
  const rect = root.value?.getBoundingClientRect()
  if (!rect) return
  above.value = window.innerHeight - rect.bottom < PANEL.height && rect.top > PANEL.height
  const limit = window.innerWidth - PANEL.margin
  let left = 0
  if (rect.left + PANEL.width > limit) left = rect.width - PANEL.width
  if (rect.left + left < PANEL.margin) left = PANEL.margin - rect.left
  if (rect.left + left + PANEL.width > limit) left = Math.max(PANEL.margin - rect.left, limit - PANEL.width - rect.left)
  offset.value = Math.round(left)
}

/** focusPanel 为 true 时把焦点交给面板（↓ 与日历按钮），否则焦点留在输入框继续输入 */
async function openPanel(focusPanel: boolean) {
  if (props.disabled) return
  if (!open.value) {
    place()
    open.value = true
  }
  await nextTick()
  const typed = focused.value ? parseTypedDate(draft.value) : null
  if (typed) panel.value?.reveal(typed)
  if (focusPanel) await panel.value?.focusCursor()
}
function close(returnFocus = false) {
  open.value = false
  if (returnFocus) input.value?.focus()
}
function toggle() {
  if (open.value) close(true)
  else void openPanel(true)
}

function emitValue(value: string) {
  typedInvalid.value = false
  draft.value = value
  if (value === props.modelValue) return
  emit('update:modelValue', value)
  emit('change', value)
}
function pick(value: string) {
  emitValue(value)
  close(true)
}

/** 确认手动输入：空串在可清空时清除，合法且在范围内时写入，否则恢复原值并标为无效 */
function commitTyped() {
  const value = draft.value.trim()
  if (value === props.modelValue) return
  if (!value && props.clearable) return emitValue('')
  const date = value ? parseTypedDate(value) : null
  const iso = date ? toIsoDate(date) : ''
  if (iso && !outOfRange(iso)) return emitValue(iso)
  typedInvalid.value = true
  draft.value = props.modelValue
}

function onFocus() {
  focused.value = true
  draft.value = props.modelValue
  void nextTick(() => input.value?.select())
}
function onBlur() {
  commitTyped()
  focused.value = false
}
function onInput(event: Event) {
  draft.value = (event.target as HTMLInputElement).value
  typedInvalid.value = false
  const date = parseTypedDate(draft.value)
  if (date && open.value) panel.value?.reveal(date)
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    // 回车只确认日期，不提交外层表单
    event.preventDefault()
    commitTyped()
    close()
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    void openPanel(true)
  } else if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    close()
  }
}

// 点击组件外部关闭
function onPointerDown(event: PointerEvent) {
  if (open.value && root.value && !root.value.contains(event.target as Node)) close()
}
onMounted(() => document.addEventListener('pointerdown', onPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))
</script>

<style scoped lang="scss">
.date-picker {
  position: relative;
  min-width: 0;
}
.date-picker__field {
  display: flex;
  align-items: center;
  min-height: 2.75rem;
  padding: 0 0.25rem 0 0.875rem;
  border-color: var(--border);
  border-radius: $radius-md;

  &.is-open,
  &:focus-within {
    border-color: var(--border-hover);
    box-shadow: 0 0 0 4px var(--accent-soft);
  }
  &.is-invalid {
    border-color: var(--danger);
  }
  &.is-disabled {
    opacity: 0.6;
  }
}
// 百分比宽度让输入框的最小内容宽度按 0 计（窄列并排字段不被撑出横向滚动），
// 首选宽度仍取默认宽度（筛选栏等按内容定宽的位置不会缩成只剩按钮）
.date-picker__input {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  padding: 0.5rem 0;
  border: 0;
  background: none;
  color: var(--text-main);
  font: inherit;
  outline: none;

  &::placeholder {
    color: var(--text-soft);
  }
  &:disabled {
    cursor: not-allowed;
  }
}
.date-picker__toggle {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border: 0;
  border-radius: $radius-sm;
  background: none;
  color: var(--text-muted);
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--hover);
    color: var(--text-main);
  }
  &:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }
  &:disabled {
    cursor: not-allowed;
  }
}
.date-picker__popover {
  position: absolute;
  top: calc(100% + 0.375rem);
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
