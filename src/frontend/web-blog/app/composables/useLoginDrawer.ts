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
  /**
   * true → 使用全屏居中 AuthModal（适合从页面中部触发，如 flash/tabs guest banner）
   * false → 使用底部栏内嵌面板（适合从底部栏按钮触发，nexus 原生体验）
   */
  const preferModal = useState('login-drawer-prefer-modal', () => false)

  const validViews: AuthView[] = ['login', 'register', 'forgot']

  function open(view: AuthView = 'login', modal = false) {
    // 防御：@click="open" 会把 MouseEvent 作为首参传入，
    // 导致 currentView 被污染，渲染落入 v-else 的找回密码分支
    currentView.value = validViews.includes(view) ? view : 'login'
    preferModal.value = modal
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
      open(view, false)
    }
  }

  return {
    isOpen,
    currentView,
    preferModal,
    open,
    close,
    switchView,
    toggle,
  }
}
