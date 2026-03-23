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
        v-if="visible && content"
        ref="floatingRef"
        class="tooltip-floating"
        :class="`tooltip-floating--${resolvedPlacement}`"
        :style="floatingStyle"
        role="tooltip"
      >
        {{ content }}
        <span class="tooltip-floating__arrow" />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
type Placement = 'top' | 'bottom' | 'left' | 'right'

const props = withDefaults(defineProps<{
  content: string
  placement?: Placement
  offset?: number
  delay?: number
}>(), {
  placement: undefined,
  offset: 8,
  delay: 200,
})

const triggerRef = ref<HTMLElement | null>(null)
const floatingRef = ref<HTMLElement | null>(null)
const visible = ref(false)
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

function onEnter() {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  showTimer = setTimeout(() => {
    visible.value = true
    nextTick(updatePosition)
  }, props.delay)
}

function onLeave() {
  if (showTimer) { clearTimeout(showTimer); showTimer = null }
  hideTimer = setTimeout(() => {
    visible.value = false
  }, 80)
}

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
  max-width: 240px;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
  white-space: nowrap;
  pointer-events: none;
  background: var(--tooltip-bg);
  color: var(--tooltip-text);
  box-shadow: var(--tooltip-shadow);
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
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.tooltip-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
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
