<!--
  @file CustomScrollbar.vue
  @description 自定义滚动条组件，隐藏原生滚动条并渲染可交互的轨道与滑块，支持拖拽、点击跳转、自动隐藏
  @author TixXin
  @since 2026-03-21
-->

<template>
  <div
    class="custom-scrollbar"
    ref="rootRef"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <div
      class="custom-scrollbar__viewport"
      ref="viewportRef"
      :class="viewportClass"
      @scroll="onScroll"
    >
      <slot />
    </div>
    <Transition name="scrollbar-fade">
      <div
        v-show="thumbVisible && needsScrollbar"
        class="custom-scrollbar__track"
        ref="trackRef"
        @mousedown.prevent="onTrackMouseDown"
      >
        <div
          class="custom-scrollbar__thumb"
          :class="{ 'is-dragging': isDragging }"
          :style="thumbStyle"
          @mousedown.prevent.stop="onThumbMouseDown"
        />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  /** 应用到滚动视口的额外 class */
  viewportClass?: string | string[] | Record<string, boolean>
  /** 滚动条自动隐藏延迟（ms） */
  autoHideDelay?: number
}>(), {
  autoHideDelay: 1500,
})

const rootRef = ref<HTMLElement | null>(null)
const viewportRef = ref<HTMLElement | null>(null)
const trackRef = ref<HTMLElement | null>(null)

const needsScrollbar = ref(false)
const thumbVisible = ref(false)
const isDragging = ref(false)
const thumbHeight = ref(0)
const thumbTop = ref(0)

let hideTimer: ReturnType<typeof setTimeout> | null = null
let resizeObserver: ResizeObserver | null = null
let mutationObserver: MutationObserver | null = null

const thumbStyle = computed(() => ({
  height: `${thumbHeight.value}px`,
  transform: `translateY(${thumbTop.value}px)`,
}))

function updateMetrics() {
  const el = viewportRef.value
  if (!el) return

  const { clientHeight, scrollHeight, scrollTop } = el
  needsScrollbar.value = scrollHeight > clientHeight + 1

  if (!needsScrollbar.value) return

  const trackEl = trackRef.value
  const trackHeight = trackEl ? trackEl.clientHeight : clientHeight - 8
  const ratio = clientHeight / scrollHeight
  thumbHeight.value = Math.max(ratio * trackHeight, 32)

  const scrollRange = scrollHeight - clientHeight
  const thumbRange = trackHeight - thumbHeight.value
  thumbTop.value = scrollRange > 0 ? (scrollTop / scrollRange) * thumbRange : 0
}

function onScroll() {
  updateMetrics()
  reveal()
  scheduleHide()
}

function reveal() {
  if (hideTimer) clearTimeout(hideTimer)
  thumbVisible.value = true
}

function scheduleHide() {
  if (hideTimer) clearTimeout(hideTimer)
  if (isDragging.value) return
  hideTimer = setTimeout(() => {
    thumbVisible.value = false
  }, props.autoHideDelay)
}

function onMouseEnter() {
  if (needsScrollbar.value) reveal()
}

function onMouseLeave() {
  if (!isDragging.value) scheduleHide()
}

// ---- Thumb 拖拽 ----
let dragStartY = 0
let dragStartScrollTop = 0

function onThumbMouseDown(e: MouseEvent) {
  isDragging.value = true
  dragStartY = e.clientY
  dragStartScrollTop = viewportRef.value?.scrollTop ?? 0
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
  document.body.style.userSelect = 'none'
  reveal()
}

function onDragMove(e: MouseEvent) {
  if (!isDragging.value || !viewportRef.value || !trackRef.value) return
  const { scrollHeight, clientHeight } = viewportRef.value
  const trackHeight = trackRef.value.clientHeight
  const scrollRange = scrollHeight - clientHeight
  const thumbRange = trackHeight - thumbHeight.value
  const deltaY = e.clientY - dragStartY
  const deltaScroll = thumbRange > 0 ? (deltaY / thumbRange) * scrollRange : 0
  viewportRef.value.scrollTop = dragStartScrollTop + deltaScroll
}

function onDragEnd() {
  isDragging.value = false
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
  document.body.style.userSelect = ''
  scheduleHide()
}

// ---- Track 点击跳转 ----
function onTrackMouseDown(e: MouseEvent) {
  if (!viewportRef.value || !trackRef.value) return
  const trackRect = trackRef.value.getBoundingClientRect()
  const clickY = e.clientY - trackRect.top
  const clickRatio = clickY / trackRect.height
  const { scrollHeight, clientHeight } = viewportRef.value
  viewportRef.value.scrollTo({
    top: clickRatio * (scrollHeight - clientHeight),
    behavior: 'smooth',
  })
}

defineExpose({
  /** 滚动视口元素 */
  viewport: viewportRef,
  /** 滚动到顶部 */
  scrollToTop(smooth = true) {
    viewportRef.value?.scrollTo({
      top: 0,
      behavior: smooth ? 'smooth' : 'instant',
    })
  },
})

onMounted(() => {
  nextTick(updateMetrics)

  if (viewportRef.value) {
    resizeObserver = new ResizeObserver(() => updateMetrics())
    resizeObserver.observe(viewportRef.value)

    // 监听子元素变化（懒加载新增内容时自动更新滚动条尺寸）
    mutationObserver = new MutationObserver(() => nextTick(updateMetrics))
    mutationObserver.observe(viewportRef.value, {
      childList: true,
      subtree: true,
    })
  }
})

onUnmounted(() => {
  if (hideTimer) clearTimeout(hideTimer)
  resizeObserver?.disconnect()
  mutationObserver?.disconnect()
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
})
</script>

<style lang="scss" scoped>
.custom-scrollbar {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.custom-scrollbar__viewport {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  -ms-overflow-style: none;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.custom-scrollbar__track {
  position: absolute;
  right: 4px;
  top: 4px;
  bottom: 4px;
  width: 6px;
  border-radius: 3px;
  z-index: 20;
  transition: width 0.2s ease, background-color 0.2s ease;

  &:hover {
    width: 10px;
    background-color: color-mix(in srgb, var(--text-soft) 8%, transparent);

    .custom-scrollbar__thumb {
      opacity: 0.5;
    }
  }
}

.custom-scrollbar__thumb {
  position: absolute;
  left: 0;
  width: 100%;
  border-radius: inherit;
  background-color: var(--text-soft);
  opacity: 0.3;
  transition: opacity 0.15s ease;
  cursor: pointer;

  &:hover {
    opacity: 0.55;
  }

  &.is-dragging {
    opacity: 0.65;
  }
}

.scrollbar-fade-enter-active,
.scrollbar-fade-leave-active {
  transition: opacity 0.3s ease;
}

.scrollbar-fade-enter-from,
.scrollbar-fade-leave-to {
  opacity: 0;
}
</style>
