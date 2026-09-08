/**
 * @file useTableOfContents.ts
 * @description 按实际滚动根和粘性标题高度计算当前章节，支持长章节与文末
 * @author TixXin
 * @since 2025-03-17
 */
import type { TocItem } from '~/features/post/types'

export function useTableOfContents(items: MaybeRefOrGetter<TocItem[]>) {
  const activeId = ref('')
  let frame = 0
  function update() {
    const headings = toValue(items)
      .map((item) => document.getElementById(item.id))
      .filter(Boolean) as HTMLElement[]
    const first = headings[0]
    if (!first) {
      activeId.value = ''
      return
    }
    const root = resolveScrollRoot(first.parentElement)
    const boundary = (root?.getBoundingClientRect().top ?? 0) + articleScrollOffset(first) + 2
    let active = first
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top <= boundary) active = heading
      else break
    }
    const body = first.closest('.article-reading-content')
    const bottom = (root?.getBoundingClientRect().bottom ?? window.innerHeight) - 12
    if (body && body.getBoundingClientRect().bottom <= bottom) active = headings.at(-1)!
    activeId.value = active.id
  }
  function schedule() {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(update)
  }
  onMounted(() => {
    document.addEventListener('scroll', schedule, { capture: true, passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    watch(
      () => toValue(items),
      () => nextTick(schedule),
      { immediate: true },
    )
  })
  onBeforeUnmount(() => {
    cancelAnimationFrame(frame)
    document.removeEventListener('scroll', schedule, true)
    window.removeEventListener('resize', schedule)
  })
  return { activeId }
}
