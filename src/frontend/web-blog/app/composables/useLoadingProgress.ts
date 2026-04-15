/**
 * @file useLoadingProgress.ts
 * @description 首屏加载假进度驱动（nprogress 风格 trickle 曲线），供顶部进度条与中央百分比共享
 * @author TixXin
 * @since 2026-04-15
 */

/**
 * 阶段配置：progress 达到 threshold 后进入该阶段，
 * 每 tick 向 target 逼近（步长 = 剩余 * factor + 随机抖动）
 */
interface PhaseConfig {
  threshold: number
  target: number
  factor: number
  jitter: number
}

// 三段式 trickle：前期快、中期缓、后期几乎停滞（nprogress 同款手感）
const PHASES: PhaseConfig[] = [
  { threshold: 0, target: 70, factor: 0.2, jitter: 2.0 },
  { threshold: 55, target: 90, factor: 0.08, jitter: 1.0 },
  { threshold: 85, target: 95, factor: 0.02, jitter: 0.3 },
]

// tick 间隔；CSS transition 200ms 负责平滑过渡
const TICK_INTERVAL = 250
// finish 后 topbar 淡出的延迟（让用户看到 100% 一瞬）
const FINISH_FADE_MS = 400

/**
 * 首屏加载进度管理
 *
 * 设计要点：
 * - progress 0-100，SSR/首帧固定 0，避免 hydration mismatch
 * - start() 仅客户端 + 仅首次访问路径调用
 * - set(v) 用于锚点事件（如 theme-preload 完成），单调递增
 * - finish() 跳 100% 并延迟隐藏 topbar；reset() 立即归零
 * - document.hidden 时暂停 tick，避免后台烧 CPU
 */
export function useLoadingProgress() {
  const progress = useState('app-loading-progress', () => 0)
  const topBarVisible = useState('app-loading-topbar-visible', () => false)

  // 模块级 timer 会导致多实例共用，这里用闭包变量，由 onScopeDispose 兜底清理
  let timer: ReturnType<typeof setInterval> | null = null

  // 从后往前找第一个满足阈值的阶段
  function pickPhase(value: number): PhaseConfig {
    for (let i = PHASES.length - 1; i >= 0; i--) {
      const phase = PHASES[i]
      if (phase && value >= phase.threshold) return phase
    }
    return PHASES[0]!
  }

  function tick() {
    if (!import.meta.client) return
    // 后台标签暂停推进
    if (document.hidden) return
    const phase = pickPhase(progress.value)
    const remaining = phase.target - progress.value
    if (remaining <= 0.1) return
    const step = remaining * phase.factor + Math.random() * phase.jitter
    progress.value = Math.min(phase.target, progress.value + step)
  }

  /** 启动 tick：仅客户端、仅首次访问路径调用 */
  function start() {
    if (!import.meta.client || timer) return
    topBarVisible.value = true
    // 立即拉到 8%，给用户"已经在加载"的即时反馈
    progress.value = Math.max(progress.value, 8)
    timer = setInterval(tick, TICK_INTERVAL)
  }

  /** 锚点推进：单调递增，不倒退，最高不超 100 */
  function set(value: number) {
    progress.value = Math.max(progress.value, Math.min(100, value))
  }

  /** 完成：跳 100% 并延迟淡出 topbar */
  function finish() {
    if (!import.meta.client) return
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    progress.value = 100
    setTimeout(() => {
      topBarVisible.value = false
    }, FINISH_FADE_MS)
  }

  /** 立即归零并隐藏（非首次访问路径 / HMR 清理） */
  function reset() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    progress.value = 0
    topBarVisible.value = false
  }

  // 组件卸载或 HMR 时清理残留 timer
  if (import.meta.client) {
    onScopeDispose(() => {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    })
  }

  return { progress, topBarVisible, start, set, finish, reset }
}
