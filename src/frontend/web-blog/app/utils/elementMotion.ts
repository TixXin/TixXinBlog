/**
 * @file elementMotion.ts
 * @description 可取消的元素入场：完成、取消、超时都只调用一次收尾，保留原内联样式
 * @author TixXin
 * @since 2026-09-07
 */
export function playElementEntrance(
  element: HTMLElement,
  done: () => void,
  options: { duration: number; delay?: number; distance?: number },
) {
  let finished = false
  let animation: Animation | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const finish = () => {
    if (finished) return
    finished = true
    if (timer) clearTimeout(timer)
    animation?.cancel()
    done()
  }
  if (options.duration <= 0 || typeof element.animate !== 'function') {
    finish()
    return finish
  }
  try {
    animation = element.animate(
      [
        { opacity: 0, transform: `translateY(${options.distance ?? 8}px)` },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: options.duration, delay: options.delay ?? 0, easing: 'ease-out', fill: 'both' },
    )
    void animation.finished.then(finish, finish)
    timer = setTimeout(finish, options.duration + (options.delay ?? 0) + 80)
  } catch {
    finish()
  }
  return finish
}
