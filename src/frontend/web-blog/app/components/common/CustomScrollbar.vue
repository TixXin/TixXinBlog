<!--
  @file CustomScrollbar.vue
  @description 自定义滚动条组件，隐藏原生滚动条并渲染可交互的轨道与滑块，支持拖拽、点击跳转、自动隐藏
  @author TixXin
  @since 2026-03-21
-->

<template>
  <div ref="rootRef" class="custom-scrollbar" @mouseenter="onMouseEnter" @mouseleave="onMouseLeave">
    <div
      ref="viewportRef"
      class="custom-scrollbar__viewport"
      :class="viewportClass"
      :style="viewportStyle"
      @scroll="onScroll"
    >
      <slot />
    </div>

    <!-- 滚动进度条：Teleport 到 body 顶部，不受父级 overflow/transform 影响 -->
    <Teleport to="body">
      <div v-if="showProgress" class="custom-scrollbar__progress" aria-hidden="true">
        <div class="custom-scrollbar__progress-bar" :style="progressBarStyle" />
      </div>
    </Teleport>

    <CommonScrollbarTrack
      ref="trackComponentRef"
      :visible="showTrack && thumbVisible && needsScrollbar"
      :thumb-height="thumbHeight"
      :thumb-top="thumbTop"
      :viewport="viewportRef"
      @drag-change="isDragging = $event"
      @reveal="reveal"
      @schedule-hide="scheduleHide"
      @scroll="onTrackScroll"
    />

    <!-- 滚动进度 / 返回顶部按钮 -->
    <CommonScrollbarBackToTop
      :visible="showBackToTop && showBackToTopBtn"
      :progress="scrollProgress"
      :clicked="progressClicked"
      @click="onProgressClick"
    />
  </div>
</template>

<script setup lang="ts">
import { resolveScrollRoot, scrollToRoot } from '~/utils/scrollRoot'
import { computeScrollbarFadeMask } from '~/utils/scrollbarMask'

const props = withDefaults(
  defineProps<{
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
    preservedQueryKeys?: string[]
    /** 主滚动区域的滚动方向：'up' 回到顶部（默认），'down' 回到底部（聊天模式） */
    primaryDirection?: 'up' | 'down'
    /** 滚动视口渐变遮罩：顶/底非边界时淡出，暗示"还能继续滚" */
    fadeMask?: 'top' | 'bottom' | 'both' | false
    /** fade mask 上下"完全透明区"的宽度（CSS 长度）。用于 viewport border-box 两端外延出 padding 区时，
     *  把 fade 的"完全透明位置"从 border-box 边界内缩，使其对齐实际希望的边界（如 main-content 边框） */
    fadeMaskInset?: string
    /** 是否渲染可拖拽的 track/thumb；关闭后仍可用滚轮/触控板滚动（配合 fadeMask 使用） */
    showTrack?: boolean
  }>(),
  {
    viewportClass: '',
    autoHideDelay: 1500,
    showProgress: false,
    showBackToTop: true,
    backToTopThreshold: 300,
    primary: false,
    preservedQueryKeys: () => [],
    primaryDirection: 'up',
    fadeMask: false,
    fadeMaskInset: '0',
    showTrack: true,
  },
)

const {
  scrollProgress: globalProgress,
  scrollResetFn: globalScrollResetFn,
  scrollDirection: globalScrollDirection,
} = useScrollProgress()

// 记录本实例注册的 resetFn，用于 unmount 时判断是否仍为当前活跃的主滚动条
let myResetFn: (() => void) | null = null

const rootRef = ref<HTMLElement | null>(null)
const viewportRef = ref<HTMLElement | null>(null)
usePageScrollRestoration(
  viewportRef,
  () => props.primary,
  () => props.preservedQueryKeys,
)
const trackComponentRef = ref<{ track: HTMLElement | null } | null>(null)

const needsScrollbar = ref(false)
const thumbVisible = ref(false)
const isDragging = ref(false)
const thumbHeight = ref(0)
const thumbTop = ref(0)
const scrollProgress = ref(0)
const showBackToTopBtn = ref(false)
// 边界位置：用于渐变遮罩的淡入淡出决策
const atTop = ref(true)
const atBottom = ref(false)

const progressClicked = ref(false)

function onProgressClick() {
  scrollToTop(true)
  progressClicked.value = true
}

function onTrackScroll(top: number) {
  if (viewportRef.value) {
    viewportRef.value.scrollTop = top
  }
}

let hideTimer: ReturnType<typeof setTimeout> | null = null
let resizeObserver: ResizeObserver | null = null
let mutationObserver: MutationObserver | null = null
let metricsFrame = 0
let cancelOwnScroll: (() => void) | undefined

function scheduleMetrics() {
  if (metricsFrame) return
  metricsFrame = requestAnimationFrame(() => {
    metricsFrame = 0
    updateMetrics()
  })
}

const progressBarStyle = computed(() => ({
  transform: `scaleX(${scrollProgress.value / 100})`,
}))

function updateMetrics() {
  const el = viewportRef.value
  if (!el) return

  const { clientHeight, scrollHeight, scrollTop } = el
  needsScrollbar.value = scrollHeight > clientHeight + 1

  // 无论是否需要滚动条，都要更新边界标志（无溢出时 atTop=true/atBottom=true，渐变全部关闭）
  atTop.value = scrollTop <= 1
  atBottom.value = !needsScrollbar.value || scrollTop + clientHeight >= scrollHeight - 1

  if (!needsScrollbar.value) return

  // track 被 v-show 隐藏时 clientHeight 为 0，退回视口高度减去 track 上下边距
  const rawTrackHeight = trackComponentRef.value?.track?.clientHeight ?? 0
  const trackHeight = rawTrackHeight > 0 ? rawTrackHeight : clientHeight - 8
  const ratio = clientHeight / scrollHeight
  thumbHeight.value = Math.max(ratio * trackHeight, 32)

  const scrollRange = scrollHeight - clientHeight
  const thumbRange = trackHeight - thumbHeight.value
  thumbTop.value = scrollRange > 0 ? (scrollTop / scrollRange) * thumbRange : 0
}

const viewportStyle = computed(() =>
  computeScrollbarFadeMask({
    fadeMask: props.fadeMask,
    fadeMaskInset: props.fadeMaskInset,
    atTop: atTop.value,
    atBottom: atBottom.value,
  }),
)

function onScroll() {
  scheduleMetrics()
  reveal()
  scheduleHide()

  const el = viewportRef.value
  if (!el) return
  const { scrollTop, scrollHeight, clientHeight } = el
  const scrollRange = scrollHeight - clientHeight
  scrollProgress.value = scrollRange > 0 ? (scrollTop / scrollRange) * 100 : 0
  showBackToTopBtn.value = scrollTop > props.backToTopThreshold

  // 主滚动区域：同步到全局滚动进度（聊天页面反转：底部0%，顶部100%）
  if (props.primary) {
    globalProgress.value = props.primaryDirection === 'down' ? 100 - scrollProgress.value : scrollProgress.value
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
  scheduleMetrics()
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

function scrollToTop(smooth = true) {
  if (viewportRef.value) cancelOwnScroll = scrollToRoot(resolveScrollRoot(viewportRef.value), 0, smooth)
}

function scrollToBottom(smooth = true) {
  const el = viewportRef.value
  if (!el) return
  const root = resolveScrollRoot(el)
  cancelOwnScroll = scrollToRoot(root, root?.scrollHeight ?? document.documentElement.scrollHeight, smooth)
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
    resizeObserver = new ResizeObserver(scheduleMetrics)
    resizeObserver.observe(viewportRef.value)

    // 监听子元素变化（懒加载新增内容时自动更新滚动条尺寸）
    mutationObserver = new MutationObserver(scheduleMetrics)
    mutationObserver.observe(viewportRef.value, {
      childList: true,
      subtree: true,
    })
  }

  // 主滚动区域：挂载时登记；聊天模式会在父页面 mounted 之后才把方向改成 down
  syncPrimaryBinding()
})

// 方向或主滚动身份变化后重绑。只在 onMounted 读一次会把留言板聊天模式永久记成返回顶部。
watch(() => [props.primary, props.primaryDirection] as const, syncPrimaryBinding)

/** 按当前方向登记回到起点的方法，并立刻改写进度，避免等下一次滚动才翻转圆环。 */
function syncPrimaryBinding() {
  if (!props.primary) {
    releasePrimaryBinding()
    return
  }
  globalScrollDirection.value = props.primaryDirection
  myResetFn = props.primaryDirection === 'down' ? () => scrollToBottom(true) : () => scrollToTop(true)
  globalScrollResetFn.value = myResetFn
  globalProgress.value = props.primaryDirection === 'down' ? 100 - scrollProgress.value : scrollProgress.value
}

/** 本实例不再是主滚动条时，只清掉自己登记的全局状态。 */
function releasePrimaryBinding() {
  if (myResetFn && globalScrollResetFn.value === myResetFn) {
    globalProgress.value = 0
    globalScrollResetFn.value = null
    globalScrollDirection.value = 'up'
  }
  myResetFn = null
}

onBeforeUnmount(() => {
  cancelOwnScroll?.()
})

onUnmounted(() => {
  cancelAnimationFrame(metricsFrame)
  if (hideTimer) clearTimeout(hideTimer)
  resizeObserver?.disconnect()
  mutationObserver?.disconnect()

  // 仅清掉本实例登记的状态。out-in 过渡里新页面先挂载，旧页面卸载时不得覆盖新登记。
  releasePrimaryBinding()
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
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}
</style>
