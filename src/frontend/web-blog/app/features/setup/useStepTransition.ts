/**
 * @file useStepTransition.ts
 * @description 初始化向导的步骤切换动画：内容向前进方向淡出 → 卡片从旧尺寸缓动到新尺寸（第二步横向展开）→
 *              新内容从另一侧滑入。动画期间内容按最终宽度锁定，避免中途重排；系统要求减少动态效果或
 *              不支持 Web Animations 时直接切换
 * @author TixXin
 * @since 2026-10-20
 */
import type { Ref } from 'vue'

const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'

/** 等待动画结束；动画被取消或环境不触发 finished 时按时长兜底，避免卡住流程 */
function settle(animations: Animation[], timeout: number) {
  return Promise.race([
    Promise.allSettled(animations.map((animation) => animation.finished)),
    new Promise((resolve) => window.setTimeout(resolve, timeout)),
  ])
}

function slide(part: HTMLElement, from: number, to: number, options: KeyframeAnimationOptions) {
  return part.animate(
    [
      { opacity: from === 0 ? 1 : 0, transform: `translateX(${from}px)` },
      { opacity: to === 0 ? 1 : 0, transform: `translateX(${to}px)` },
    ],
    options,
  )
}

export function prefersReducedMotion() {
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * @param step 当前步骤
 * @param card 参与尺寸动画的卡片
 * @param parts 参与淡出滑入的内容（标题文字、步骤内容）；操作栏不在其中，随卡片底边移动
 */
export function useStepTransition(step: Ref<1 | 2>, card: Ref<HTMLElement | null>, parts: () => HTMLElement[]) {
  const switching = ref(false)

  async function switchStep(target: 1 | 2) {
    if (step.value === target) return
    const element = card.value
    if (!element || prefersReducedMotion() || typeof element.animate !== 'function') {
      step.value = target
      await nextTick()
      return
    }
    const direction = target > step.value ? 1 : -1
    switching.value = true
    try {
      const leaving = parts().map((part) =>
        slide(part, 0, -24 * direction, { duration: 160, easing: 'ease-in', fill: 'forwards' }),
      )
      await settle(leaving, 260)
      const first = element.getBoundingClientRect()
      step.value = target
      await nextTick()
      const last = element.getBoundingClientRect()
      leaving.forEach((animation) => animation.cancel())
      // 内容按最终宽度排好并锁定，卡片缩放时只是逐步露出，中途不会因宽度变化重排（如单列跳成两列）
      const locked = parts()
      locked.forEach((part) => (part.style.width = `${part.getBoundingClientRect().width}px`))
      const resize = element.animate(
        [
          { maxWidth: `${first.width}px`, height: `${first.height}px` },
          { maxWidth: `${last.width}px`, height: `${last.height}px` },
        ],
        { duration: 420, easing: EASING },
      )
      const entering = parts().map((part) =>
        slide(part, 24 * direction, 0, { duration: 380, delay: 140, easing: EASING, fill: 'backwards' }),
      )
      await settle([resize, ...entering], 700)
      locked.forEach((part) => (part.style.width = ''))
    } finally {
      switching.value = false
    }
  }

  return { switching, switchStep }
}
