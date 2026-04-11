/**
 * @file useLoginDrawer.ts
 * @description 登录弹窗/面板状态管理，跨主题共享
 * @author TixXin
 * @since 2026-04-10
 */

import type { AuthView } from '~/features/auth/types'

export function useLoginDrawer() {
  const isOpen = useState('login-drawer-open', () => false)
  const currentView = useState<AuthView>('login-drawer-view', () => 'login')

  function open(view: AuthView = 'login') {
    currentView.value = view
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  function switchView(view: AuthView) {
    currentView.value = view
  }

  function toggle(view: AuthView = 'login') {
    if (isOpen.value) {
      close()
    } else {
      open(view)
    }
  }

  return {
    isOpen,
    currentView,
    open,
    close,
    switchView,
    toggle,
  }
}
