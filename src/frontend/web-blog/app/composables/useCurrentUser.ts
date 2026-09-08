/**
 * @file useCurrentUser.ts
 * @description 真实管理员登录态：访问令牌仅留在内存，刷新令牌使用同源 HttpOnly Cookie
 */
import type { CurrentUser } from '~/features/auth/types'
import { withAuthCookieLock } from '~/utils/authCookieLock'
import { clearCommentDrafts } from '~/features/post/commentSession'

interface AuthPayload {
  accessToken: string
  expiresIn: number
  user: { id: string; username: string }
}
let refreshing: Promise<boolean> | null = null
let loggingOut = false
let restoring: Promise<boolean> | null = null

export function useCurrentUser() {
  const nuxtApp = useNuxtApp()
  const currentUser = useState<CurrentUser | null>('current-user', () => null)
  const accessToken = useState<string | null>('auth-access-token', () => null)
  const initialized = useState('auth-initialized', () => false)
  const authError = useState('auth-error', () => '')
  const isLoggedIn = computed(() => currentUser.value !== null && accessToken.value !== null)

  function accept(payload: AuthPayload) {
    if (currentUser.value && currentUser.value.id !== payload.user.id) clearCommentDrafts(nuxtApp)
    accessToken.value = payload.accessToken
    currentUser.value = {
      id: payload.user.id,
      nickname: payload.user.username,
      email: '',
      avatar: '/avatar.svg',
      role: 'owner',
    }
    authError.value = ''
  }
  async function login(username: string, password: string) {
    const result = await withAuthCookieLock(() =>
      $fetch<{ code: number; data: AuthPayload }>('/api/v1/auth/login', {
        method: 'POST',
        body: { username, password },
        credentials: 'include',
        retry: 0,
        timeout: 10000,
      }),
    )
    accept(result.data)
    initialized.value = true
  }
  async function refresh(): Promise<boolean> {
    if (import.meta.server) return false
    if (loggingOut) return false
    if (refreshing) return refreshing
    refreshing = withAuthCookieLock(async () => {
      try {
        const result = await $fetch<{ data: AuthPayload }>('/api/v1/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          retry: 0,
          timeout: 10000,
        })
        accept(result.data)
        return true
      } catch (cause) {
        const status = (cause as { statusCode?: number }).statusCode
        if (status === 401) {
          if (currentUser.value) clearCommentDrafts(nuxtApp)
          currentUser.value = null
          accessToken.value = null
        }
        authError.value = status === 401 ? '登录已过期，请重新登录' : '登录状态暂时无法确认，请重试'
        return false
      } finally {
        refreshing = null
      }
    })
    return refreshing
  }
  async function restore() {
    if (import.meta.server || initialized.value) return isLoggedIn.value
    if (restoring) return restoring
    restoring = (async () => {
      try {
        const result = await $fetch<{ data: { authenticated: boolean } }>('/api/v1/auth/session', {
          credentials: 'include',
          retry: 0,
          timeout: 10000,
        })
        if (result.data.authenticated) {
          const restored = await refresh()
          initialized.value = restored || authError.value === '登录已过期，请重新登录'
        } else initialized.value = true
      } catch {
        authError.value = '登录状态暂时无法确认，请重试'
      }
      return isLoggedIn.value
    })()
    try {
      return await restoring
    } finally {
      restoring = null
    }
  }
  async function clearSession(message = '') {
    loggingOut = true
    try {
      if (refreshing) await refreshing
      clearCommentDrafts(nuxtApp)
      currentUser.value = null
      accessToken.value = null
      initialized.value = true
      authError.value = message
    } finally {
      loggingOut = false
    }
  }
  async function logout() {
    if (loggingOut) return
    loggingOut = true
    try {
      // 等已发出的刷新完成，再撤销其最新 Cookie，避免迟到响应恢复已退出会话。
      if (refreshing) await refreshing
      await withAuthCookieLock(() =>
        $fetch<{ data: { ok: boolean } }>('/api/v1/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: accessToken.value ? { Authorization: `Bearer ${accessToken.value}` } : {},
          retry: 0,
          timeout: 10000,
        }),
      )
      clearCommentDrafts(nuxtApp)
      currentUser.value = null
      accessToken.value = null
      initialized.value = true
    } finally {
      loggingOut = false
    }
  }
  return { currentUser, accessToken, initialized, authError, isLoggedIn, login, restore, refresh, logout, clearSession }
}
