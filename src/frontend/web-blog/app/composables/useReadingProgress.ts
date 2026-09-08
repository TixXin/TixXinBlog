/**
 * @file useReadingProgress.ts
 * @description 以文章正文而非评论区计算阅读进度，适配文档和主题内部滚动
 * @author TixXin
 * @since 2025-03-17
 */
import type { Ref } from 'vue'

export function useReadingProgress(scrollRoot: Ref<HTMLElement | null | undefined>, content: Ref<HTMLElement | null>) {
  const progress = ref(0)
  let frame = 0
  let observer: ResizeObserver | null = null
  function update() {
    const element = content.value
    if (!element) return
    const root = resolveScrollRoot(scrollRoot.value ?? element.parentElement)
    const bounds = element.getBoundingClientRect()
    const top = (root?.getBoundingClientRect().top ?? 0) + articleScrollOffset(element)
    const bottom = root?.getBoundingClientRect().bottom ?? window.innerHeight
    const range = bounds.height - (bottom - top)
    progress.value =
      range <= 0
        ? bounds.bottom <= bottom
          ? 100
          : 0
        : Math.round(Math.max(0, Math.min(100, ((top - bounds.top) / range) * 100)))
  }
  function schedule() {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(update)
  }
  onMounted(() => {
    document.addEventListener('scroll', schedule, { capture: true, passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    observer = new ResizeObserver(schedule)
    if (content.value) observer.observe(content.value)
    schedule()
  })
  onBeforeUnmount(() => {
    cancelAnimationFrame(frame)
    observer?.disconnect()
    document.removeEventListener('scroll', schedule, true)
    window.removeEventListener('resize', schedule)
  })
  return { progress }
}
