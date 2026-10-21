/**
 * @file useFlashCitation.ts
 * @description 闪念 AI 搜索引用平滑滚动聚焦与 2 秒脉冲高亮动画编排
 * @author TixXin
 * @since 2026-10-21
 */

import { resolveScrollRoot, scrollToRoot } from '~/utils/scrollRoot'

export function useFlashCitation(clearFilters: () => void) {
  const highlightedNoteId = ref<string | null>(null)
  let highlightTimer: ReturnType<typeof setTimeout> | undefined
  let cancelCitationScroll: (() => void) | undefined
  let citationAlive = true

  onBeforeUnmount(() => {
    citationAlive = false
    if (highlightTimer) clearTimeout(highlightTimer)
    cancelCitationScroll?.()
  })

  function onCiteClick(noteId: string) {
    clearFilters()
    if (highlightTimer) clearTimeout(highlightTimer)
    cancelCitationScroll?.()
    highlightedNoteId.value = noteId
    nextTick(() => {
      if (!citationAlive) return
      const node = document.getElementById(`flash-note-${noteId}`)
      if (!node) return
      const root = resolveScrollRoot(node.parentElement)
      const rect = node.getBoundingClientRect()
      const top =
        (root?.scrollTop ?? window.scrollY) +
        rect.top -
        (root?.getBoundingClientRect().top ?? 0) -
        (root?.clientHeight ?? window.innerHeight) / 2 +
        rect.height / 2
      cancelCitationScroll = scrollToRoot(root, top)
      node.setAttribute('tabindex', '-1')
      node.focus({ preventScroll: true })
      node.addEventListener('blur', () => node.removeAttribute('tabindex'), { once: true })
      highlightTimer = setTimeout(() => {
        highlightedNoteId.value = null
      }, 2000)
    })
  }

  return {
    highlightedNoteId,
    onCiteClick,
  }
}
