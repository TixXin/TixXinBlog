/**
 * @file useEntranceMotion.ts
 * @description 由组件作用域持有入场任务，偏好变化、进入取消及卸载立即完成全部收尾
 * @author TixXin
 * @since 2026-09-07
 */
import { playElementEntrance } from '~/utils/elementMotion'

export function useEntranceMotion() {
  const { reducedMotion } = useMotionPreference()
  const running = new Map<Element, () => void>()
  const cancel = (element: Element) => running.get(element)?.()
  const finishAll = () => [...running.values()].forEach((finish) => finish())
  function enter(element: Element, done: () => void, options: { delay?: number; distance?: number } = {}) {
    cancel(element)
    if (reducedMotion.value || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      done()
      return
    }
    let synchronous = true
    let complete = false
    const finish = playElementEntrance(
      element as HTMLElement,
      () => {
        complete = true
        if (!synchronous) running.delete(element)
        done()
      },
      { duration: 200, ...options },
    )
    synchronous = false
    if (!complete) running.set(element, finish)
  }
  watch(
    reducedMotion,
    (reduced) => {
      if (reduced) finishAll()
    },
    { flush: 'sync' },
  )
  onBeforeUnmount(finishAll)
  return { enter, cancel }
}
