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

    <!-- 滚动进度条：Teleport 到 body 顶部，不受父级 overflow/transform 影响 -->
    <Teleport to="body">
      <div
        v-if="showProgress"
        class="custom-scrollbar__progress"
        aria-hidden="true"
      >
        <div
          class="custom-scrollbar__progress-bar"
          :style="progressBarStyle"
        />
      </div>
    </Teleport>

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

    <!-- 滚动进度 / 返回顶部按钮 -->
    <Transition name="back-to-top">
      <div
        v-if="showBackToTop && showBackToTopBtn"
        class="custom-scrollbar__back-to-top"
      >
        <CommonTooltip content="返回顶部" placement="left">
          <button
            type="button"
            class="custom-scrollbar__back-to-top-btn"
            :class="{ 'is-clicked': progressClicked }"
            aria-label="返回顶部"
            @click="onProgressClick"
          >
            <span class="custom-scrollbar__progress-text">{{ displayProgress }}%</span>
            <Icon name="lucide:arrow-up" size="16" class="custom-scrollbar__progress-icon" />
          </button>
        </CommonTooltip>
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
  /** 是否显示顶部滚动进度条 */
  showProgress?: boolean
  /** 是否显示返回顶部按钮 */
  showBackToTop?: boolean
  /** 返回顶部按钮出现阈值（px） */
  backToTopThreshold?: number
  /** 是否为当前页面的主滚动区域（写入全局滚动进度） */
  primary?: boolean
}>(), {
  autoHideDelay: 1500,
  showProgress: false,
  showBackToTop: true,
  backToTopThreshold: 300,
  primary: false,
})

const { scrollProgress: globalProgress, scrollToTopFn: globalScrollToTopFn } = useScrollProgress()

const rootRef = ref<HTMLElement | null>(null)
const viewportRef = ref<HTMLElement | null>(null)
const trackRef = ref<HTMLElement | null>(null)

const needsScrollbar = ref(false)
const thumbVisible = ref(false)
const isDragging = ref(false)
const thumbHeight = ref(0)
const thumbTop = ref(0)
const scrollProgress = ref(0)
const showBackToTopBtn = ref(false)

const progressClicked = ref(false)
const displayProgress = computed(() => Math.round(scrollProgress.value))

function onProgressClick() {
  scrollToTop(true)
  progressClicked.value = true
}

let hideTimer: ReturnType<typeof setTimeout> | null = null
let resizeObserver: ResizeObserver | null = null
let mutationObserver: MutationObserver | null = null

const thumbStyle = computed(() => ({
  height: `${thumbHeight.value}px`,
  transform: `translateY(${thumbTop.value}px)`,
}))

const progressBarStyle = computed(() => ({
  transform: `scaleX(${scrollProgress.value / 100})`,
}))

function updateMetrics() {
  const el = viewportRef.value
  if (!el) return

  const { clientHeight, scrollHeight, scrollTop } = el
  needsScrollbar.value = scrollHeight > clientHeight + 1

  if (!needsScrollbar.value) return

  // track 被 v-show 隐藏时 clientHeight 为 0，退回视口高度减去 track 上下边距
  const rawTrackHeight = trackRef.value?.clientHeight ?? 0
  const trackHeight = rawTrackHeight > 0 ? rawTrackHeight : clientHeight - 8
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

  const el = viewportRef.value
  if (!el) return
  const { scrollTop, scrollHeight, clientHeight } = el
  const scrollRange = scrollHeight - clientHeight
  scrollProgress.value = scrollRange > 0 ? (scrollTop / scrollRange) * 100 : 0
  showBackToTopBtn.value = scrollTop > props.backToTopThreshold

  // 主滚动区域：同步到全局滚动进度
  if (props.primary) {
    globalProgress.value = scrollProgress.value
  }

  // 用户滚动后重置点击状态
  if (progressClicked.value && scrollProgress.value > 1) {
    progressClicked.value = false
  }
}

function reveal() {
  if (hideTimer) clearTimeout(hideTimer)
  thumbVisible.value = true
  // track 从隐藏变可见后 DOM 尺寸才更新，等下一帧用真实 trackHeight 修正滑块
  nextTick(updateMetrics)
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

function scrollToTop(smooth = true) {
  viewportRef.value?.scrollTo({
    top: 0,
    behavior: smooth ? 'smooth' : 'instant',
  })
}

defineExpose({
  /** 滚动视口元素 */
  viewport: viewportRef,
  /** 滚动进度 0~100 */
  scrollProgress,
  /** 滚动到顶部 */
  scrollToTop,
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

  // 主滚动区域：注册全局回到顶部方法
  if (props.primary) {
    globalScrollToTopFn.value = () => scrollToTop(true)
  }
})

onUnmounted(() => {
  if (hideTimer) clearTimeout(hideTimer)
  resizeObserver?.disconnect()
  mutationObserver?.disconnect()
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)

  // 主滚动区域：清理全局状态
  if (props.primary) {
    globalProgress.value = 0
    globalScrollToTopFn.value = null
  }
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

.custom-scrollbar__progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  z-index: 100;
  pointer-events: none;
  overflow: hidden;
}

.custom-scrollbar__progress-bar {
  height: 100%;
  width: 100%;
  background: #22c55e;
  transform-origin: left;
  transition: transform 0.1s ease-out;
}

.custom-scrollbar__back-to-top {
  position: absolute;
  bottom: 20px;
  right: 20px;
  z-index: 20;

  @media (max-width: #{$breakpoint-sm - 0.02}) {
    bottom: 16px;
    right: 16px;
  }
}

.custom-scrollbar__back-to-top-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.75rem;
  height: 2.25rem;
  padding: 0.25rem 0.625rem;
  border-radius: $radius-full;
  border: 1px solid var(--border);
  background: var(--surface-1-alpha);
  backdrop-filter: blur(12px);
  color: var(--text-soft);
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.15s ease;

  &:hover {
    color: var(--accent);
    background: var(--surface-2);
    border-color: var(--border-hover);
    box-shadow: var(--shadow-card);

    .custom-scrollbar__progress-text {
      opacity: 0;
      transform: scale(0.6);
    }

    .custom-scrollbar__progress-icon {
      opacity: 1;
      transform: translateY(0);
      animation: scrollbar-progress-bounce 0.6s ease infinite;
    }
  }

  &:active {
    transform: scale(0.95);
  }

  // 点击回顶后 hover 不再切换图标
  &.is-clicked:hover {
    .custom-scrollbar__progress-text {
      opacity: 1;
      transform: none;
    }

    .custom-scrollbar__progress-icon {
      opacity: 0;
      transform: translateY(4px);
      animation: none;
    }
  }

  @media (max-width: #{$breakpoint-sm - 0.02}) {
    min-width: 2.5rem;
    height: 2rem;
    font-size: 0.6875rem;
  }
}

.custom-scrollbar__progress-text {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.custom-scrollbar__progress-icon {
  position: absolute;
  opacity: 0;
  transform: translateY(4px);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

@keyframes scrollbar-progress-bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-3px);
  }
  60% {
    transform: translateY(1px);
  }
}

.back-to-top-enter-active {
  transition: opacity 0.25s ease-out, transform 0.25s ease-out;
}

.back-to-top-leave-active {
  transition: opacity 0.2s ease-in, transform 0.2s ease-in;
}

.back-to-top-enter-from,
.back-to-top-leave-to {
  opacity: 0;
  transform: scale(0.8) translateY(8px);
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
