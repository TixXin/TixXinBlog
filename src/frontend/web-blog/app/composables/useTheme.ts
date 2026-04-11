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

    // circle 预设需要根据「当前实际模式 → 目标实际模式」决定动画方向：
    //   明 → 暗：expand（暗色新层从点击点扩张覆盖）— 动画 ::view-transition-new(root)
    //   暗 → 明：retract（暗色旧层从外向点击点收缩消失）— 动画 ::view-transition-old(root)
    // colorMode.value 是已解析的当前模式（'light' | 'dark'），preference='system' 时也会解析；
    // 目标 preference='system' 时需要再用 matchMedia 解析一次
    let direction: 'expand' | 'retract' = 'expand'
    if (preset === 'circle') {
      const currentEffective = colorMode.value
      const targetEffective =
        theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme
      if (currentEffective === 'dark' && targetEffective === 'light') {
        direction = 'retract'
      }
      root.dataset.colorModeAnimDir = direction
    }

    const transition = document.startViewTransition(async () => {
      colorMode.preference = theme
      await nextTick()
    })

    // circle 预设：JS 驱动 clip-path 实现展开 / 收回（圆心用百分比对齐 VT 伪元素参考盒）
    if (preset === 'circle') {
      const { x, y } = getEventOrigin(event)
      const vw = window.innerWidth || 1
      const vh = window.innerHeight || 1
      const xPct = (x / vw) * 100
      const yPct = (y / vh) * 100
      const endRadius = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y))
      const fromCircle = `circle(0 at ${xPct}% ${yPct}%)`
      const toCircle = `circle(${endRadius}px at ${xPct}% ${yPct}%)`
      // retract 方向：动画作用在 old 层（CSS 配套把 old 提到 new 之上），从大圆收缩到点击点
      const pseudoElement = direction === 'retract' ? '::view-transition-old(root)' : '::view-transition-new(root)'
      const clipPathFrames = direction === 'retract' ? [toCircle, fromCircle] : [fromCircle, toCircle]
      transition.ready
        .then(() => {
          root.animate(
            { clipPath: clipPathFrames },
            {
              duration: 520,
              easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
              pseudoElement,
              // 必须 forwards：retract 方向播完后若让 clip-path 重置回默认（无裁剪），
              // old(暗) 层会瞬间满屏再被销毁，肉眼一闪。fill:forwards 让 clip-path
              // 保持在最终关键帧（circle(0)），直到伪元素被 VT 收尾清理。
              fill: 'forwards',
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
        delete root.dataset.colorModeAnimDir
      })
  }

  return {
    currentPreference,
    themeOptions,
    setTheme,
  }
}
