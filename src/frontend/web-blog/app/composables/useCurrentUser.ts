/**
 * @file useCurrentUser.ts
 * @description 当前登录用户状态管理（mock 阶段），跨主题/组件共享
 * @author TixXin
 * @since 2026-04-11
 */

import type { CurrentUser } from '~/features/auth/types'
import { mockVisitorUser } from '~/features/auth/mock'

export function useCurrentUser() {
  // null = 未登录；非空 = 已登录用户
  const currentUser = useState<CurrentUser | null>('current-user', () => null)

  /** 是否已登录 */
  const isLoggedIn = computed(() => currentUser.value !== null)

  /** 设置登录用户（mock：直接接受 user 对象） */
  function setUser(user: CurrentUser) {
    currentUser.value = user
  }

  /** mock 登录：使用样例访客用户 */
  function loginAsVisitor() {
    currentUser.value = { ...mockVisitorUser }
  }

  /** 退出登录 */
  function logout() {
    currentUser.value = null
  }

  return {
    currentUser,
    isLoggedIn,
    setUser,
    loginAsVisitor,
    logout,
  }
}
