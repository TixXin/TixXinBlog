/**
 * @file usePostListAnimation.ts
 * @description 文章列表瀑布流模式下新卡片交错入场动画控制
 * @author TixXin
 * @since 2026-04-03
 */
import { resolveScrollRoot } from '~/utils/scrollRoot'

/**
 * 管理瀑布流新卡片的交错入场动画。
 * 仅对新增卡片执行动画，已有卡片直接跳过。
 */
export function usePostListAnimation(displayCount: Ref<number>) {
  const { enter, cancel } = useEntranceMotion()
  let prevCount = displayCount.value

  watch(displayCount, (_new, old) => {
    prevCount = old
  })

  function onItemEnter(el: Element, done: () => void) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      done()
      return
    }
    const htmlEl = el as HTMLElement
    const index = Number(htmlEl.dataset.index ?? 0)

    if (index < prevCount) {
      done()
      return
    }

    // 仅对当前阅读视口内的新增项交错入场，离屏条目不占用动画和尾延迟预算。
    const bounds = resolveScrollRoot(htmlEl.parentElement)?.getBoundingClientRect()
    const rect = htmlEl.getBoundingClientRect()
    if (
      rect.bottom <= Math.max(0, bounds?.top ?? 0) ||
      rect.top >= Math.min(innerHeight, bounds?.bottom ?? innerHeight)
    ) {
      done()
      return
    }

    enter(el, done, { delay: Math.min(Math.max(0, index - prevCount) * 25, 150), distance: 8 })
  }

  return { onItemEnter, onItemEnterCancelled: cancel }
}
