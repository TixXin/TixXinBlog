/**
 * @file useAdminShortcuts.ts
 * @description 后台键盘快捷键：Ctrl/⌘ + K 开关命令面板；列表页按 / 聚焦筛选栏的搜索框，按 n 触发页头主操作（新建）。
 *              捕获阶段处理并阻止默认行为，全站快捷键（同样绑定 Ctrl/⌘ + K）因 defaultPrevented 跳过；
 *              正在输入、按着其他修饰键或有模态层时，单键快捷键不生效
 * @author TixXin
 * @since 2026-11-06
 */

function typing(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
}

/** Ctrl/⌘ + K，不含 Alt 或 Shift */
function isPaletteKey(event: KeyboardEvent) {
  return (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k'
}

/** 单键快捷键只在没有修饰键、不在输入、面板与其他模态层都未打开时生效 */
function singleKeyBlocked(event: KeyboardEvent, paletteOpen: boolean) {
  return (
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.repeat ||
    typing(event.target) ||
    paletteOpen ||
    !!document.querySelector('[aria-modal="true"], dialog[open]')
  )
}

/** / 聚焦筛选栏搜索框，n 触发页头主操作；页面没有对应元素时不拦截按键 */
function runSingleKey(key: string) {
  if (key === '/') {
    const search = document.querySelector<HTMLInputElement>(
      '.admin-main .admin-filter-bar input:not([type="checkbox"]):not([type="radio"])',
    )
    if (!search) return false
    search.focus()
    search.select()
    return true
  }
  if (key === 'n') {
    const create = document.querySelector<HTMLElement>('.admin-main .admin-page-header .admin-btn--primary')
    if (!create || create.matches(':disabled')) return false
    create.click()
    return true
  }
  return false
}

export function useAdminShortcuts(palette: Ref<boolean>) {
  function onKeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing) return
    if (isPaletteKey(event)) {
      event.preventDefault()
      palette.value = !palette.value
    } else if (!singleKeyBlocked(event, palette.value) && runSingleKey(event.key)) event.preventDefault()
  }
  onMounted(() => window.addEventListener('keydown', onKeydown, true))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown, true))
}
