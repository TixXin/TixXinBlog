/**
 * @file useTheme.ts
 * @description 明暗主题切换组合式函数，用 View Transitions API 驱动四种切换动画预设
 * @author TixXin
 * @since 2025-03-17
 */

import type { ColorModeTransitionPreset, ThemeOption } from '~/features/appearance/types'
import { COLOR_MODE_OPTIONS, DEFAULT_COLOR_MODE_TRANSITION_PRESET } from '~/features/appearance/types'
import { hasColorMotion, runColorMotion } from '~/utils/colorMotion'

// View Transitions API 类型自 TS 5.6 起已内置于 DOM lib,无需本地声明

/**
 * 解析指针原点，用于圆形展开动画的圆心定位（视口 CSS 像素）。
 * 优先级：
 *   1. Pointer/Mouse 的 `clientX/Y`（允许贴边为 0；仅当二者均为 0 时再走下方）
 *   2. 触发元素 `getBoundingClientRect` 中心（键盘激活按钮时常见 0,0）
 *   3. 视口中心 fallback
 */
function getEventOrigin(event?: Event | null): { x: number; y: number } {
  if (event && 'clientX' in event && 'clientY' in event) {
    const pe = event as PointerEvent | MouseEvent
    const cx = pe.clientX
    const cy = pe.clientY
    if (Number.isFinite(cx) && Number.isFinite(cy) && (cx !== 0 || cy !== 0)) {
      return { x: cx, y: cy }
    }
    const target = (pe.currentTarget ?? pe.target) as HTMLElement | null
    if (target && typeof target.getBoundingClientRect === 'function') {
      const rect = target.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    }
  }
  const vw = window.innerWidth
  const vh = window.innerHeight
  return { x: vw / 2, y: vh / 2 }
}

export function useTheme() {
  const colorMode = useColorMode()
  const themeOptions = COLOR_MODE_OPTIONS
  // 在setup中读取纯状态，事件回调不能再次创建包含媒体查询订阅的composable。
  const colorModeTransitionPreset = useState<ColorModeTransitionPreset>(
    'appearance-color-mode-transition-preset',
    () => DEFAULT_COLOR_MODE_TRANSITION_PRESET,
  )

  const currentPreference = computed(() => colorMode.preference as ThemeOption)

  /**
   * 切换明暗主题。不支持 View Transitions 或开启减少动效时，直接瞬间切换。
   * @param theme  目标主题（light / dark / system）
   * @param event  可选指针/点击事件，用于圆形展开动画取坐标（建议 pointerdown）
   */
  function setTheme(theme: ThemeOption, event?: Event | null) {
    if (!import.meta.client) {
      colorMode.preference = theme
      return
    }

    const preset = colorModeTransitionPreset.value
    if (currentPreference.value === theme && !hasColorMotion(document)) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const root = document.documentElement
    const target = theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme
    const direction = colorMode.value === 'dark' && target === 'light' ? 'retract' : 'expand'
    const { x, y } = getEventOrigin(event)
    const vw = window.innerWidth || 1
    const vh = window.innerHeight || 1
    const origin = `${(x / vw) * 100}% ${(y / vh) * 100}%`
    const radius = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y))
    const frames = [`circle(0 at ${origin})`, `circle(${radius}px at ${origin})`]
    runColorMotion({
      doc: document,
      key: theme,
      preset: reducedMotion || preset === 'none' ? 'instant' : preset,
      direction: preset === 'circle' ? direction : undefined,
      apply: () => {
        colorMode.preference = theme
      },
      animate:
        preset === 'circle'
          ? () =>
              root.animate(
                { clipPath: direction === 'retract' ? [...frames].reverse() : frames },
                {
                  duration: 320,
                  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                  pseudoElement:
                    direction === 'retract' ? '::view-transition-old(root)' : '::view-transition-new(root)',
                  fill: 'forwards',
                },
              )
          : undefined,
    })
  }

  return {
    currentPreference,
    themeOptions,
    setTheme,
  }
}
