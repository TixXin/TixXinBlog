/**
 * @file useDevKeyboardShortcuts.ts
 * @description Dev 调试面板键盘快捷键组合函数
 * @author TixXin
 * @since 2026-10-21
 */

import type { Ref } from 'vue'

export function useDevKeyboardShortcuts(isOpen: Ref<boolean>, toggle: () => void, close: () => void) {
  function onKeydown(e: KeyboardEvent) {
    // Ctrl/Cmd + Shift + D：全局开关
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
      e.preventDefault()
      toggle()
      return
    }
    // Esc：仅在抽屉开启时关闭
    if (e.key === 'Escape' && isOpen.value) {
      e.preventDefault()
      close()
    }
  }

  return { onKeydown }
}
