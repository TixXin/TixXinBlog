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

  const validViews: AuthView[] = ['login', 'register', 'forgot']

  function open(view: AuthView = 'login') {
    // 防御：@click="open" 会把 MouseEvent 作为首参传入，
    // 导致 currentView 被污染，渲染落入 v-else 的找回密码分支
    currentView.value = validViews.includes(view) ? view : 'login'
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
