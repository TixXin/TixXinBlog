/** @file useSearchPageKeyboard.ts @description 搜索页输入框与结果列表间的上下方向键焦点流转与键盘事件处理 */
import type { Ref } from 'vue'

export function useSearchPageKeyboard(options: {
  inputRef: Ref<HTMLInputElement | null>
  resultListRef: Ref<HTMLElement | null>
  keyword: Ref<string>
  activeQuery: Ref<string>
  isSearching: Ref<boolean>
}) {
  const { inputRef, resultListRef, keyword, activeQuery, isSearching } = options

  function resultLinks() {
    return Array.from(resultListRef.value?.querySelectorAll<HTMLAnchorElement>('a[data-search-result]') ?? [])
  }

  function isResultArrow(event: KeyboardEvent) {
    return (
      !event.isComposing &&
      event.keyCode !== 229 &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      (event.key === 'ArrowDown' || event.key === 'ArrowUp')
    )
  }

  function focusResult(link: HTMLAnchorElement | undefined) {
    if (!link) return
    link.focus({ preventScroll: true })
    // 键盘定位不播放滚动动画，也不依赖主题的动效设置。
    link.scrollIntoView({ block: 'nearest', behavior: 'instant' })
  }

  function onInputKeydown(event: KeyboardEvent) {
    if (!isResultArrow(event) || isSearching.value || keyword.value.trim() !== activeQuery.value.trim()) return
    const links = resultLinks()
    if (!links.length) return
    event.preventDefault()
    focusResult(event.key === 'ArrowDown' ? links[0] : links.at(-1))
  }

  function onResultKeydown(event: KeyboardEvent) {
    if (!isResultArrow(event) || isSearching.value) return
    const target = event.target instanceof Element ? event.target.closest('a[data-search-result]') : null
    const links = resultLinks()
    const index = links.findIndex((link) => link === target)
    if (index < 0) return
    event.preventDefault()
    focusResult(links[(index + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length])
  }

  function restoreFocusToInput() {
    if (resultListRef.value?.contains(document.activeElement)) {
      inputRef.value?.focus({ preventScroll: true })
    }
  }

  return {
    onInputKeydown,
    onResultKeydown,
    restoreFocusToInput,
  }
}
