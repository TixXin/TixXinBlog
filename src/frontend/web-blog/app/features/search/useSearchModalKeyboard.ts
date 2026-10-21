/** @file useSearchModalKeyboard.ts @description 搜索弹窗结果键盘虚拟光标流转与选择播报 */
import type { ComputedRef, Ref } from 'vue'
import type { SearchResultItem } from '~/composables/useSearch'

export function useSearchModalKeyboard(options: {
  navigableResults: ComputedRef<SearchResultItem[]>
  selectedIndex: Ref<number>
  resultListRef: Ref<HTMLElement | null>
  inputRef: Ref<HTMLInputElement | null>
  navigateTo: (item: Pick<SearchResultItem, 'type' | 'url'>) => void | Promise<void>
}) {
  const { navigableResults, selectedIndex, resultListRef, inputRef, navigateTo } = options
  const { t } = useI18n()

  const selectionAnnouncement = computed(() => {
    const item = navigableResults.value[selectedIndex.value]
    return item
      ? t('layout.searchModal.selection', {
          index: selectedIndex.value + 1,
          total: navigableResults.value.length,
          title: item.title,
        })
      : ''
  })

  function resetSelection() {
    selectedIndex.value = -1
    // 结果刷新会移除原链接；将焦点交回输入框，避免落到弹窗外。
    if (resultListRef.value?.contains(document.activeElement)) {
      void nextTick(() => inputRef.value?.focus({ preventScroll: true }))
    }
  }

  function onResultKeydown(event: KeyboardEvent) {
    // 输入法候选项和带修饰键的浏览器快捷键不属于结果导航。
    if (
      event.isComposing ||
      (event.keyCode !== undefined && event.keyCode === 229) ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey
    )
      return
    if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key) || !navigableResults.value.length) return
    const target = event.currentTarget
    const fromLink = target instanceof HTMLAnchorElement
    const currentIndex = fromLink ? Number(target.dataset.resultIndex) : selectedIndex.value
    // 关闭弹窗会改变焦点；先取消 Enter 的默认激活，避免重新点击搜索入口。
    event.preventDefault()
    if (event.key === 'Enter') {
      const item = navigableResults.value[Math.max(0, currentIndex)]
      if (item) void navigateTo(item)
      return
    }
    selectedIndex.value =
      currentIndex < 0
        ? event.key === 'ArrowDown'
          ? 0
          : navigableResults.value.length - 1
        : Math.max(0, Math.min(navigableResults.value.length - 1, currentIndex + (event.key === 'ArrowDown' ? 1 : -1)))
    // 输入框保留编辑焦点并播报选择；从链接导航时同步原生焦点。
    if (fromLink) {
      resultListRef.value
        ?.querySelector<HTMLElement>(`[data-result-index="${selectedIndex.value}"]`)
        ?.focus({ preventScroll: true })
    }
  }

  return {
    selectionAnnouncement,
    resetSelection,
    onResultKeydown,
  }
}
