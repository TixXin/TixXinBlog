/**
 * @file scrollRoot.ts
 * @description 根据实际溢出样式识别滚动根，统一文档与主题内部滚动的定位
 * @author TixXin
 * @since 2026-09-07
 */
export function resolveScrollRoot(element: HTMLElement | null): HTMLElement | null {
  for (let node = element; node && node !== document.body; node = node.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1) return node
  }
  return null
}

const scrolling = new Map<HTMLElement | Window, { interrupt: () => void; complete: () => void }>()
if (import.meta.hot) import.meta.hot.dispose(() => [...scrolling.values()].forEach((task) => task.interrupt()))

export function stopRootScroll(root: HTMLElement | null) {
  scrolling.get(root ?? window)?.interrupt()
}

export function finishRootScrolls() {
  ;[...scrolling.values()].forEach((task) => task.complete())
}

/** 原生平滑滚动也必须让用户输入优先；取消只停止补间，不阻止原本的滚轮或按键。 */
export function scrollToRoot(root: HTMLElement | null, top: number, smooth = true) {
  const target = root ?? window
  stopRootScroll(root)
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!smooth || reduced) {
    target.scrollTo({ top, behavior: 'instant' })
    return undefined
  }
  let active = true
  const events: EventTarget = root ?? document
  const cleanup = () => {
    if (!active) return
    active = false
    clearTimeout(timer)
    events.removeEventListener('wheel', interrupt, true)
    events.removeEventListener('touchstart', interrupt, true)
    document.removeEventListener('pointerdown', interrupt, true)
    document.removeEventListener('keydown', interrupt, true)
    events.removeEventListener('scrollend', onScrollEnd)
    if (scrolling.get(target) === task) scrolling.delete(target)
  }
  const interrupt = () => {
    if (!active) return
    target.scrollTo({ top: root?.scrollTop ?? window.scrollY, behavior: 'instant' })
    cleanup()
  }
  const onScrollEnd = () => {
    const maximum = root ? root.scrollHeight - root.clientHeight : document.documentElement.scrollHeight - innerHeight
    if (Math.abs((root?.scrollTop ?? scrollY) - Math.max(0, Math.min(top, maximum))) <= 1) cleanup()
  }
  const task = {
    interrupt,
    complete: () => {
      if (!active) return
      target.scrollTo({ top, behavior: 'instant' })
      cleanup()
    },
  }
  const timer = setTimeout(cleanup, 2000)
  scrolling.set(target, task)
  events.addEventListener('wheel', interrupt, { capture: true, passive: true })
  events.addEventListener('touchstart', interrupt, { capture: true, passive: true })
  document.addEventListener('pointerdown', interrupt, { capture: true, passive: true })
  document.addEventListener('keydown', interrupt, true)
  events.addEventListener('scrollend', onScrollEnd)
  target.scrollTo({ top, behavior: 'smooth' })
  return interrupt
}

export function articleScrollOffset(element: HTMLElement): number {
  const header = element.closest('.article-page')?.querySelector<HTMLElement>('.article-sticky-header')
  return header && getComputedStyle(header).position === 'sticky' ? header.getBoundingClientRect().height + 12 : 12
}

export function scrollArticleHeading(target: HTMLElement) {
  const root = resolveScrollRoot(target.parentElement)
  const top =
    target.getBoundingClientRect().top -
    (root?.getBoundingClientRect().top ?? 0) +
    (root?.scrollTop ?? window.scrollY) -
    articleScrollOffset(target)
  scrollToRoot(root, top)
}
