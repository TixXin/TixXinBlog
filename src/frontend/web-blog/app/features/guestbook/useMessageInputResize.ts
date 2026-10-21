/**
 * @file useMessageInputResize.ts
 * @description 留言输入框高度自适应与手动拖拽缩放组合函数
 * @author TixXin
 * @since 2026-10-21
 */

import type { Ref } from 'vue'

const MIN_HEIGHT = 72
const EXPANDED_HEIGHT = 240
const AUTO_MAX = 200

export function useMessageInputResize(options: {
  draft: () => string
  textareaRef: Ref<HTMLTextAreaElement | null>
  mirrorRef: Ref<HTMLTextAreaElement | null>
}) {
  const { t } = useI18n()
  const baseHeight = ref(MIN_HEIGHT)
  const manualHeight = ref<number | null>(null)
  const contentHeight = ref(0)
  const resizing = ref(false)

  const editorHeight = computed(
    () => manualHeight.value ?? Math.max(baseHeight.value, Math.min(contentHeight.value, AUTO_MAX)),
  )
  const isExpanded = computed(() => editorHeight.value > 100)
  const expandLabel = computed(() =>
    t(isExpanded.value ? 'interaction.guestbookInput.collapse' : 'interaction.guestbookInput.expand'),
  )

  function toggleExpand() {
    if (isExpanded.value) {
      baseHeight.value = MIN_HEIGHT
      manualHeight.value = MIN_HEIGHT
    } else {
      baseHeight.value = EXPANDED_HEIGHT
      manualHeight.value = null
    }
  }

  /** 副本高度为 0 时 scrollHeight 即正文加内边距的自然高度 */
  function measureContent() {
    const mirror = options.mirrorRef.value
    if (!mirror) return
    mirror.value = options.draft()
    contentHeight.value = Math.ceil(mirror.scrollHeight)
  }

  watch(options.draft, (draft) => {
    if (!draft) manualHeight.value = null
    nextTick(measureContent)
  })

  let widthObserver: ResizeObserver | null = null
  let lastWidth = 0

  onMounted(() => {
    measureContent()
    // 宽度变化会改变折行，需要重新量；只看宽度，避免高度过渡本身反复触发
    widthObserver = new ResizeObserver(([entry]) => {
      const width = Math.round(entry?.contentRect.width ?? 0)
      if (width === lastWidth) return
      lastWidth = width
      measureContent()
    })
    if (options.textareaRef.value) widthObserver.observe(options.textareaRef.value)
  })

  let resizeStartY = 0
  let resizeStartHeight = 0

  function onResizePointerMove(event: PointerEvent) {
    manualHeight.value = Math.max(44, Math.min(320, resizeStartHeight + resizeStartY - event.clientY))
  }

  function onResizePointerUp() {
    window.removeEventListener('pointermove', onResizePointerMove)
    resizing.value = false
  }

  function onResizePointerDown(event: PointerEvent) {
    if (event.button !== 0) return
    event.preventDefault()
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
    resizeStartY = event.clientY
    resizeStartHeight = editorHeight.value
    resizing.value = true
    window.addEventListener('pointermove', onResizePointerMove)
    window.addEventListener('pointerup', onResizePointerUp, { once: true })
  }

  onBeforeUnmount(() => {
    widthObserver?.disconnect()
    window.removeEventListener('pointermove', onResizePointerMove)
    window.removeEventListener('pointerup', onResizePointerUp)
  })

  return {
    editorHeight,
    resizing,
    isExpanded,
    expandLabel,
    toggleExpand,
    onResizePointerDown,
  }
}
