<!-- @file ScrollbarTrack.vue @description 自定义滚动条的交互式轨道与拖拽滑块 -->
<template>
  <Transition name="scrollbar-fade">
    <div v-show="visible" ref="trackRef" class="custom-scrollbar__track" @mousedown.prevent="onTrackMouseDown">
      <div
        class="custom-scrollbar__thumb"
        :class="{ 'is-dragging': isDragging }"
        :style="thumbStyle"
        @mousedown.prevent.stop="onThumbMouseDown"
      />
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { scrollToRoot } from '~/utils/scrollRoot'

const props = defineProps<{
  visible: boolean
  thumbHeight: number
  thumbTop: number
  viewport: HTMLElement | null
}>()

const emit = defineEmits<{
  (e: 'dragChange', isDragging: boolean): void
  (e: 'reveal' | 'scheduleHide'): void
  (e: 'scroll', scrollTop: number): void
}>()

const trackRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)

const thumbStyle = computed(() => ({
  height: `${props.thumbHeight}px`,
  transform: `translateY(${props.thumbTop}px)`,
}))

let dragStartY = 0
let dragStartScrollTop = 0
let originalUserSelect = ''

function onThumbMouseDown(e: MouseEvent) {
  isDragging.value = true
  emit('dragChange', true)
  dragStartY = e.clientY
  dragStartScrollTop = props.viewport?.scrollTop ?? 0
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
  originalUserSelect = document.body.style.userSelect
  document.body.style.userSelect = 'none'
  emit('reveal')
}

function onDragMove(e: MouseEvent) {
  if (!isDragging.value || !props.viewport || !trackRef.value) return
  const { scrollHeight, clientHeight } = props.viewport
  const trackHeight = trackRef.value.clientHeight
  const scrollRange = scrollHeight - clientHeight
  const thumbRange = trackHeight - props.thumbHeight
  const deltaY = e.clientY - dragStartY
  const deltaScroll = thumbRange > 0 ? (deltaY / thumbRange) * scrollRange : 0
  emit('scroll', dragStartScrollTop + deltaScroll)
}

function onDragEnd() {
  isDragging.value = false
  emit('dragChange', false)
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
  document.body.style.userSelect = originalUserSelect
  emit('scheduleHide')
}

function onTrackMouseDown(e: MouseEvent) {
  if (!props.viewport || !trackRef.value) return
  const trackRect = trackRef.value.getBoundingClientRect()
  const clickY = e.clientY - trackRect.top
  const clickRatio = clickY / trackRect.height
  const { scrollHeight, clientHeight } = props.viewport
  scrollToRoot(props.viewport, clickRatio * (scrollHeight - clientHeight))
}

defineExpose({
  track: trackRef,
})

onBeforeUnmount(() => {
  if (isDragging.value) {
    document.body.style.userSelect = originalUserSelect
    document.removeEventListener('mousemove', onDragMove)
    document.removeEventListener('mouseup', onDragEnd)
  }
})
</script>

<style lang="scss" scoped>
.custom-scrollbar__track {
  position: absolute;
  right: 4px;
  top: var(--scrollbar-track-inset, 4px);
  bottom: var(--scrollbar-track-inset, 4px);
  width: 6px;
  border-radius: 3px;
  z-index: 20;
  transition:
    width 0.2s ease,
    background-color 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

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
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  cursor: var(--interaction-cursor, grab);

  &:hover {
    opacity: 0.55;
  }

  &.is-dragging {
    cursor: var(--interaction-cursor, grabbing);
    opacity: 0.65;
  }
}

.scrollbar-fade-enter-active,
.scrollbar-fade-leave-active {
  transition: opacity 0.3s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.scrollbar-fade-enter-from,
.scrollbar-fade-leave-to {
  opacity: 0;
}
</style>
