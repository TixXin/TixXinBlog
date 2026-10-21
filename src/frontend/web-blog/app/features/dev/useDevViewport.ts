/**
 * @file useDevViewport.ts
 * @description Dev 调试面板视口与滚动状态管理组合函数
 * @author TixXin
 * @since 2026-10-21
 */

import type { Ref } from 'vue'
import { resolveBreakpoint } from './viewport'

export function useDevViewport(options?: { isOpen?: Ref<boolean>; isDragging?: Ref<boolean> }) {
  const viewport = useState<{ w: number; h: number }>('dev-debug:viewport', () => ({ w: 0, h: 0 }))
  const dpr = useState<number>('dev-debug:dpr', () => 1)
  const isMobileUA = useState<boolean>('dev-debug:isMobileUA', () => false)
  const scrollY = useState<number>('dev-debug:scrollY', () => 0)

  function syncViewport() {
    if (!import.meta.client) return
    viewport.value = { w: window.innerWidth, h: window.innerHeight }
    dpr.value = window.devicePixelRatio
  }

  function syncScroll() {
    if (!import.meta.client) return
    scrollY.value = Math.round(window.scrollY)
  }

  // 向下滚动时收起 FAB，避免遮挡正文；向上滚动、回到顶部、面板打开或拖动中保持可见
  const fabScrollHidden = ref(false)
  watch(scrollY, (y, prev) => {
    if (Math.abs(y - prev) < 8) return
    fabScrollHidden.value = y > 80 && y > prev
  })

  const fabHidden = computed(() => {
    const isOpen = options?.isOpen?.value ?? false
    const isDragging = options?.isDragging?.value ?? false
    return fabScrollHidden.value && !isOpen && !isDragging
  })

  const bp = computed(() => resolveBreakpoint(viewport.value.w))
  const breakpoint = computed(() => bp.value.breakpoint)
  const breakpointHint = computed(() => bp.value.hint)

  return {
    viewport,
    dpr,
    isMobileUA,
    scrollY,
    fabHidden,
    breakpoint,
    breakpointHint,
    syncViewport,
    syncScroll,
  }
}
