/**
 * @file useDevDrawerDrag.ts
 * @description Dev 调试面板抽屉与 FAB 拖拽手柄、尺寸调整及样式计算组合函数
 * @author TixXin
 * @since 2026-10-21
 */

import type { Ref } from 'vue'
import type { DevDebugDockPosition, FabPosition, CenterRect } from '~/composables/useDevDebugPanel'

export interface UseDevDrawerDragOptions {
  isOpen: Ref<boolean>
  position: Ref<DevDebugDockPosition>
  fontScale: Ref<number>
  fabPosition: Ref<FabPosition>
  centerRect: Ref<CenterRect>
  setFabPosition: (pos: FabPosition) => void
  setCenterRect: (rect: CenterRect) => void
  toggle: () => void
}

export function useDevDrawerDrag(options: UseDevDrawerDragOptions) {
  const { isOpen, position, fontScale, fabPosition, centerRect, setFabPosition, setCenterRect, toggle } = options

  /** 不同停靠位置使用不同 transition：边贴边滑入，居中态 fade+scale */
  const transitionName = computed(() => {
    switch (position.value) {
      case 'left':
        return 'dev-debug-drawer-left'
      case 'right':
        return 'dev-debug-drawer-right'
      case 'top':
        return 'dev-debug-drawer-top'
      case 'bottom':
        return 'dev-debug-drawer-bottom'
      case 'center':
        return 'dev-debug-drawer-center'
      default:
        return 'dev-debug-drawer-left'
    }
  })

  /**
   * 抽屉 inline style：始终注入 zoom（独立缩放系数）+ --dev-debug-zoom CSS 变量
   * 居中态额外注入 top/left/width/height
   */
  const drawerStyle = computed(() => {
    const scale = String(fontScale.value)
    const base: Record<string, string> = {
      zoom: scale,
      '--dev-debug-zoom': scale,
    }
    if (position.value === 'center') {
      const r = centerRect.value
      base.top = `${r.y}px`
      base.left = `${r.x}px`
      base.width = `${r.w}px`
      base.height = `${r.h}px`
    }
    return base
  })

  const fabStyle = computed(() => ({
    top: `${fabPosition.value.y}px`,
    left: `${fabPosition.value.x}px`,
  }))

  // ---- FAB 拖拽 ----
  const isDragging = ref(false)
  let dragOffset = { x: 0, y: 0 }
  let movedDistance = 0

  function onFabPointerDown(e: PointerEvent) {
    if (isOpen.value) return // 抽屉打开时禁止拖动
    if (e.button !== 0) return // 仅左键
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    dragOffset = {
      x: e.clientX - fabPosition.value.x,
      y: e.clientY - fabPosition.value.y,
    }
    movedDistance = 0
    isDragging.value = true
    window.addEventListener('pointermove', onFabPointerMove)
    window.addEventListener('pointerup', onFabPointerUp, { once: true })
  }

  function onFabPointerMove(e: PointerEvent) {
    movedDistance += Math.abs(e.movementX) + Math.abs(e.movementY)
    fabPosition.value = {
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y,
    }
  }

  function onFabPointerUp() {
    window.removeEventListener('pointermove', onFabPointerMove)
    isDragging.value = false
    setFabPosition(fabPosition.value)
  }

  function onFabClick() {
    // 拖动距离 > 5px 视为拖动而非点击，不触发 toggle
    if (movedDistance > 5) {
      movedDistance = 0
      return
    }
    toggle()
  }

  // ---- 居中模式：header 拖拽 ----
  let headerDragStart = { clientX: 0, clientY: 0, x: 0, y: 0 }

  function onHeaderPointerDown(e: PointerEvent) {
    if (position.value !== 'center') return
    const target = e.target as HTMLElement
    if (target.closest('button')) return
    if (e.button !== 0) return
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    headerDragStart = {
      clientX: e.clientX,
      clientY: e.clientY,
      x: centerRect.value.x,
      y: centerRect.value.y,
    }
    window.addEventListener('pointermove', onHeaderPointerMove)
    window.addEventListener('pointerup', onHeaderPointerUp, { once: true })
  }

  function onHeaderPointerMove(e: PointerEvent) {
    const scale = fontScale.value || 1
    centerRect.value = {
      ...centerRect.value,
      x: headerDragStart.x + (e.clientX - headerDragStart.clientX) / scale,
      y: headerDragStart.y + (e.clientY - headerDragStart.clientY) / scale,
    }
  }

  function onHeaderPointerUp() {
    window.removeEventListener('pointermove', onHeaderPointerMove)
    setCenterRect(centerRect.value)
  }

  // ---- 居中模式：自定义右下角 resize 手柄 ----
  let resizeStart = { x: 0, y: 0, w: 0, h: 0 }

  function onResizePointerDown(e: PointerEvent) {
    if (position.value !== 'center') return
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    resizeStart = {
      x: e.clientX,
      y: e.clientY,
      w: centerRect.value.w,
      h: centerRect.value.h,
    }
    window.addEventListener('pointermove', onResizePointerMove)
    window.addEventListener('pointerup', onResizePointerUp, { once: true })
  }

  function onResizePointerMove(e: PointerEvent) {
    const scale = fontScale.value || 1
    const nextW = Math.max(360, resizeStart.w + (e.clientX - resizeStart.x) / scale)
    const nextH = Math.max(320, resizeStart.h + (e.clientY - resizeStart.y) / scale)
    centerRect.value = { ...centerRect.value, w: nextW, h: nextH }
  }

  function onResizePointerUp() {
    window.removeEventListener('pointermove', onResizePointerMove)
    setCenterRect(centerRect.value)
  }

  function cleanupDragListeners() {
    if (!import.meta.client) return
    window.removeEventListener('pointermove', onFabPointerMove)
    window.removeEventListener('pointermove', onHeaderPointerMove)
    window.removeEventListener('pointermove', onResizePointerMove)
  }

  return {
    transitionName,
    drawerStyle,
    fabStyle,
    isDragging,
    onFabPointerDown,
    onFabClick,
    onHeaderPointerDown,
    onResizePointerDown,
    cleanupDragListeners,
  }
}
