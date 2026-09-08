<!--
  @file Tooltip.vue
  @description 通用 Tooltip 提示组件，支持自动定位、明暗主题适配、方向箭头与入场/退场动画
  @author TixXin
  @since 2026-03-24
-->

<template>
  <span
    ref="triggerRef"
    class="tooltip-trigger"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
    @focusin="onEnter"
    @focusout="onLeave"
  >
    <slot />
  </span>

  <Teleport to="body">
    <Transition name="tooltip">
      <div
        v-if="visible && (content || hasContentSlot)"
        :id="tooltipId"
        ref="floatingRef"
        class="tooltip-floating"
        :class="[`tooltip-floating--${resolvedPlacement}`, { 'tooltip-floating--rich': rich }]"
        :style="floatingStyle"
        role="tooltip"
        @mouseenter="onFloatingEnter"
        @mouseleave="onFloatingLeave"
        @focusin="onFloatingEnter"
        @focusout="onFloatingLeave"
      >
        <slot name="content">{{ content }}</slot>
        <span class="tooltip-floating__arrow" />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
type Placement = 'top' | 'bottom' | 'left' | 'right'

const props = withDefaults(
  defineProps<{
    content?: string
    placement?: Placement
    offset?: number
    delay?: number
    disabled?: boolean
    rich?: boolean
  }>(),
  {
    content: undefined,
    placement: undefined,
    offset: 8,
    delay: 200,
    disabled: false,
    rich: false,
  },
)

const slots = useSlots()
const hasContentSlot = computed(() => !!slots.content)

const triggerRef = ref<HTMLElement | null>(null)
const floatingRef = ref<HTMLElement | null>(null)
const visible = ref(false)
const tooltipId = useId()
let triggerHover = false
let triggerFocus = false
let floatingActive = false
let dismissed = false
let positionFrame = 0
const resolvedPlacement = ref<Placement>('top')
const floatingStyle = ref<Record<string, string>>({
  top: '0px',
  left: '0px',
})

let showTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null

/** display:contents 的元素没有自身盒模型，取第一个子元素用于定位 */
function getTriggerElement(): HTMLElement | null {
  const el = triggerRef.value
  if (!el) return null
  return (el.firstElementChild as HTMLElement) ?? el
}

watch(
  () => props.disabled,
  (val) => {
    if (val) visible.value = false
  },
)

function onEnter(event: Event) {
  if (event.type === 'focusin') triggerFocus = true
  else triggerHover = true
  if (showTimer) clearTimeout(showTimer)
  if (props.disabled) return
  if (dismissed) return
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  showTimer = setTimeout(() => {
    if (props.disabled || dismissed || (!triggerHover && !triggerFocus)) return
    visible.value = true
    nextTick(updatePosition)
  }, props.delay)
}

function onLeave(event: Event) {
  if (event.type === 'focusout') triggerFocus = false
  else triggerHover = false
  if (!triggerHover && !triggerFocus) dismissed = false
  if (showTimer) {
    clearTimeout(showTimer)
    showTimer = null
  }
  scheduleHide()
}

function scheduleHide() {
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    if (!triggerHover && !triggerFocus && !floatingActive) visible.value = false
  }, 140)
}
function onFloatingEnter() {
  floatingActive = true
  if (hideTimer) clearTimeout(hideTimer)
}
function onFloatingLeave() {
  floatingActive = false
  scheduleHide()
}
function onEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !visible.value) return
  event.preventDefault()
  event.stopImmediatePropagation()
  dismissed = true
  visible.value = false
  if (showTimer) clearTimeout(showTimer)
}
function schedulePosition() {
  if (positionFrame) return
  positionFrame = requestAnimationFrame(() => {
    positionFrame = 0
    updatePosition()
  })
}
function onFocusChange() {
  if (getTriggerElement()?.closest('[inert]')) visible.value = false
}
watch(
  visible,
  (shown, _previous, onCleanup) => {
    if (!shown) return
    const trigger = getTriggerElement()
    if (!trigger) return
    const descriptions = new Set((trigger.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean))
    descriptions.add(tooltipId)
    trigger.setAttribute('aria-describedby', [...descriptions].join(' '))
    window.addEventListener('keydown', onEscape, true)
    window.addEventListener('resize', schedulePosition)
    document.addEventListener('scroll', schedulePosition, { capture: true, passive: true })
    document.addEventListener('focusin', onFocusChange)
    onCleanup(() => {
      window.removeEventListener('keydown', onEscape, true)
      window.removeEventListener('resize', schedulePosition)
      document.removeEventListener('scroll', schedulePosition, true)
      document.removeEventListener('focusin', onFocusChange)
      cancelAnimationFrame(positionFrame)
      positionFrame = 0
      const remaining = (trigger.getAttribute('aria-describedby') || '')
        .split(/\s+/)
        .filter((id) => id && id !== tooltipId)
      if (remaining.length) trigger.setAttribute('aria-describedby', remaining.join(' '))
      else trigger.removeAttribute('aria-describedby')
    })
  },
  { flush: 'post' },
)

function detectPlacement(triggerRect: DOMRect): Placement {
  if (props.placement) return props.placement

  const { innerWidth: vw, innerHeight: vh } = window
  const spaceTop = triggerRect.top
  const spaceBottom = vh - triggerRect.bottom
  const spaceLeft = triggerRect.left
  const spaceRight = vw - triggerRect.right

  const minRequired = 40

  if (spaceTop >= minRequired) return 'top'
  if (spaceBottom >= minRequired) return 'bottom'
  if (spaceRight >= minRequired) return 'right'
  if (spaceLeft >= minRequired) return 'left'

  const max = Math.max(spaceTop, spaceBottom, spaceLeft, spaceRight)
  if (max === spaceTop) return 'top'
  if (max === spaceBottom) return 'bottom'
  if (max === spaceRight) return 'right'
  return 'left'
}

function updatePosition() {
  const trigger = getTriggerElement()
  const floating = floatingRef.value
  if (!trigger || !floating) return

  const triggerRect = trigger.getBoundingClientRect()
  if (
    !trigger.isConnected ||
    trigger.closest('[inert]') ||
    triggerRect.bottom <= 0 ||
    triggerRect.top >= window.innerHeight
  ) {
    visible.value = false
    return
  }
  const floatingRect = floating.getBoundingClientRect()
  const placement = detectPlacement(triggerRect)
  resolvedPlacement.value = placement

  let top = 0
  let left = 0

  const cx = triggerRect.left + triggerRect.width / 2
  const cy = triggerRect.top + triggerRect.height / 2

  switch (placement) {
    case 'top':
      top = triggerRect.top - floatingRect.height - props.offset
      left = cx - floatingRect.width / 2
      break
    case 'bottom':
      top = triggerRect.bottom + props.offset
      left = cx - floatingRect.width / 2
      break
    case 'left':
      top = cy - floatingRect.height / 2
      left = triggerRect.left - floatingRect.width - props.offset
      break
    case 'right':
      top = cy - floatingRect.height / 2
      left = triggerRect.right + props.offset
      break
  }

  const vw = window.innerWidth
  const vh = window.innerHeight
  const margin = 6
  left = Math.max(margin, Math.min(left, vw - floatingRect.width - margin))
  top = Math.max(margin, Math.min(top, vh - floatingRect.height - margin))

  floatingStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
  }
}

onBeforeUnmount(() => {
  cancelAnimationFrame(positionFrame)
  if (showTimer) clearTimeout(showTimer)
  if (hideTimer) clearTimeout(hideTimer)
})
</script>

<style lang="scss">
.tooltip-trigger {
  display: contents;
}

.tooltip-floating {
  position: fixed;
  z-index: 9999;
  max-width: min(240px, calc(100vw - 16px));
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
  white-space: normal;
  overflow-wrap: anywhere;
  pointer-events: auto;
  background: var(--tooltip-bg);
  color: var(--tooltip-text);
  box-shadow: var(--tooltip-shadow);

  &--rich {
    white-space: normal;
    max-width: min(280px, calc(100vw - 16px));
    padding: 8px 14px;
  }
}

.tooltip-floating__arrow {
  position: absolute;
  width: 0;
  height: 0;
  border: 5px solid transparent;
}

// 箭头方向与入场偏移
.tooltip-floating--top {
  .tooltip-floating__arrow {
    bottom: -10px;
    left: 50%;
    transform: translateX(-50%);
    border-top-color: var(--tooltip-bg);
  }
}

.tooltip-floating--bottom {
  .tooltip-floating__arrow {
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    border-bottom-color: var(--tooltip-bg);
  }
}

.tooltip-floating--left {
  .tooltip-floating__arrow {
    right: -10px;
    top: 50%;
    transform: translateY(-50%);
    border-left-color: var(--tooltip-bg);
  }
}

.tooltip-floating--right {
  .tooltip-floating__arrow {
    left: -10px;
    top: 50%;
    transform: translateY(-50%);
    border-right-color: var(--tooltip-bg);
  }
}

// 入场/退场动画
.tooltip-enter-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.tooltip-leave-active {
  transition:
    opacity 0.1s ease,
    transform 0.1s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
}

.tooltip-floating--top.tooltip-enter-from,
.tooltip-floating--top.tooltip-leave-to {
  transform: translateY(4px);
}

.tooltip-floating--bottom.tooltip-enter-from,
.tooltip-floating--bottom.tooltip-leave-to {
  transform: translateY(-4px);
}

.tooltip-floating--left.tooltip-enter-from,
.tooltip-floating--left.tooltip-leave-to {
  transform: translateX(4px);
}

.tooltip-floating--right.tooltip-enter-from,
.tooltip-floating--right.tooltip-leave-to {
  transform: translateX(-4px);
}
</style>
