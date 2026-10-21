/**
 * @file viewport.ts
 * @description Dev 视口调试预设与纯逻辑计算
 * @author TixXin
 * @since 2026-10-21
 */

import type { ViewportPreset } from './types'

export const VIEWPORT_WINDOW = 'tixxin-dev-viewport'

export const VIEWPORT_PRESETS: readonly ViewportPreset[] = [
  { label: '小屏手机', w: 375, h: 667, icon: 'lucide:smartphone' },
  { label: '手机', w: 393, h: 852, icon: 'lucide:smartphone' },
  { label: '平板竖屏', w: 768, h: 1024, icon: 'lucide:tablet' },
  { label: '平板横屏', w: 1024, h: 768, icon: 'lucide:tablet' },
  { label: '笔记本', w: 1366, h: 768, icon: 'lucide:laptop' },
  { label: '桌面', w: 1440, h: 900, icon: 'lucide:monitor' },
  { label: '全高清', w: 1920, h: 1080, icon: 'lucide:monitor' },
] as const

/** 根据窗口宽度解析响应式断点与提示文案 */
export function resolveBreakpoint(width: number): { breakpoint: string; hint: string } {
  if (width >= 1280) return { breakpoint: 'xl', hint: '≥1280' }
  if (width >= 1024) return { breakpoint: 'lg', hint: '1024–1279' }
  if (width >= 768) return { breakpoint: 'md', hint: '768–1023' }
  if (width >= 640) return { breakpoint: 'sm', hint: '640–767' }
  if (width >= 480) return { breakpoint: 'xs', hint: '480–639' }
  return { breakpoint: '<xs', hint: '<480' }
}

/** 补偿窗口边框工具栏外框差值，使页面内容区精确匹配指定视口大小 */
export function fitViewport(target: Window, w: number, h: number) {
  target.resizeTo(w + target.outerWidth - target.innerWidth, h + target.outerHeight - target.innerHeight)
}

/** 按预设或自定义尺寸打开或调整同名调试视口弹出窗口 */
export function openViewport(w: number, h: number, onBlocked?: () => void) {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 240 || h < 240) return
  if (!import.meta.client) return

  // 已在预览窗口内：直接调整自身
  if (window.name === VIEWPORT_WINDOW) {
    fitViewport(window, w, h)
    return
  }
  const target = window.open(window.location.href, VIEWPORT_WINDOW, `popup,width=${w},height=${h}`)
  if (!target) {
    onBlocked?.()
    return
  }
  target.focus()
  // 同名窗口已存在时浏览器只导航、不改尺寸；稍后按内容区尺寸校正一次
  window.setTimeout(() => {
    try {
      if (!target.closed && (target.innerWidth !== w || target.innerHeight !== h)) {
        fitViewport(target, w, h)
      }
    } catch {
      // 窗口仍在导航或已被关闭时跳过
    }
  }, 600)
}
