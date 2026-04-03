/**
 * @file usePostListAnimation.ts
 * @description 文章列表瀑布流模式下新卡片交错入场动画控制
 * @author TixXin
 * @since 2026-04-03
 */

const PAGE_SIZE = 15

/**
 * 管理瀑布流新卡片的交错入场动画。
 * 仅对新增卡片执行动画，已有卡片直接跳过。
 */
export function usePostListAnimation(displayCount: Ref<number>) {
  let prevCount = PAGE_SIZE

  watch(displayCount, (_new, old) => {
    prevCount = old
  })

  function onItemEnter(el: Element, done: () => void) {
    const htmlEl = el as HTMLElement
    const index = Number(htmlEl.dataset.index ?? 0)

    if (index < prevCount) {
      done()
      return
    }

    const offset = index - prevCount
    const delay = offset * 50
    const duration = 350

    htmlEl.style.opacity = '0'
    htmlEl.style.transform = 'translateY(20px)'

    requestAnimationFrame(() => {
      htmlEl.style.transition = `opacity ${duration}ms ease ${delay}ms, transform ${duration}ms ease ${delay}ms`
      htmlEl.style.opacity = '1'
      htmlEl.style.transform = 'translateY(0)'

      setTimeout(() => {
        htmlEl.style.transition = ''
        htmlEl.style.transform = ''
        htmlEl.style.opacity = ''
        done()
      }, duration + delay)
    })
  }

  return { onItemEnter }
}
