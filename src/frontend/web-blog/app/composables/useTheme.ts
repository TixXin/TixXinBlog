/**
 * @file useTheme.ts
 * @description 明暗主题切换组合式函数，用 View Transitions API 驱动四种切换动画预设
 * @author TixXin
 * @since 2025-03-17
 */

import type { ThemeOption } from '~/features/appearance/types'
import { COLOR_MODE_OPTIONS } from '~/features/appearance/types'

// View Transitions API 类型声明（TS 默认 lib 尚未内置）
declare global {
  interface Document {
    startViewTransition?: (callback: () => Promise<void> | void) => {
      ready: Promise<void>
      finished: Promise<void>
      updateCallbackDone: Promise<void>
      skipTransition: () => void
    }
  }
}

/**
 * 解析点击原点，用于圆形展开动画的圆心定位。
 * 优先级：
 *   1. 鼠标实际按下的屏幕坐标 `event.clientX/Y`（非 0,0 合成坐标）
 *   2. 按钮 `getBoundingClientRect` 中心（键盘回车/空格触发 click 时 clientX/Y=0）
 *   3. 屏幕中心 fallback
 */
function getEventOrigin(event?: MouseEvent): { x: number; y: number } {
  if (event) {
    if (
      Number.isFinite(event.clientX) &&
      Number.isFinite(event.clientY) &&
      (event.clientX !== 0 || event.clientY !== 0)
    ) {
      return { x: event.clientX, y: event.clientY }
    }
    const target = (event.currentTarget ?? event.target) as HTMLElement | null
    if (target && typeof target.getBoundingClientRect === 'function') {
      const rect = target.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    }
  }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
}

export function useTheme() {
  const colorMode = useColorMode()
  const themeOptions = COLOR_MODE_OPTIONS

  const currentPreference = computed(() => colorMode.preference as ThemeOption)

  /**
   * 切换明暗主题。不支持 View Transitions 或开启减少动效时，直接瞬间切换。
   * @param theme  目标主题（light / dark / system）
   * @param event  可选点击事件，用于圆形展开动画取点击坐标
   */
  function setTheme(theme: ThemeOption, event?: MouseEvent) {
    if (!import.meta.client) {
      colorMode.preference = theme
      return
    }

    const { colorModeTransitionPreset } = useAppearanceSettings()
    const preset = colorModeTransitionPreset.value
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // 无动画 / 减少动效 / 浏览器不支持 View Transitions → 瞬间切换
    if (reducedMotion || preset === 'none' || typeof document.startViewTransition !== 'function') {
      colorMode.preference = theme
      return
    }

    const root = document.documentElement
    root.dataset.colorModeAnim = preset

    const transition = document.startViewTransition(async () => {
      colorMode.preference = theme
      await nextTick()
    })

    // circle 预设：JS 驱动 clip-path 从点击点展开
    if (preset === 'circle') {
      const { x, y } = getEventOrigin(event)
      const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
      transition.ready
        .then(() => {
          root.animate(
            {
              clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`],
            },
            {
              duration: 520,
              easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
              pseudoElement: '::view-transition-new(root)',
            },
          )
        })
        .catch(() => {
          // animate() 失败静默忽略：最终回落到浏览器默认交叉淡入
        })
    }

    // 切换结束后清理 data-attribute，让 CSS 规则恢复默认
    transition.finished
      .catch(() => {})
      .finally(() => {
        delete root.dataset.colorModeAnim
      })
  }

  return {
    currentPreference,
    themeOptions,
    setTheme,
  }
}
