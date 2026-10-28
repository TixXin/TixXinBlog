/**
 * @file useCurrentUser.ts
 * @description 真实管理员登录态：访问令牌仅留在内存，刷新令牌使用同源 HttpOnly Cookie
 */
import { invalidateIdentityReads, invalidatePublicReads } from '~/utils/invalidatePublicReads'
import type { CurrentUser } from '~/features/auth/types'
import { withAuthCookieLock, withAuthCookieRead } from '~/utils/authCookieLock'
import { clearCommentDrafts } from '~/features/post/commentSession'
import { clearMomentDrafts } from '~/features/moment/session'

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
  // 静态发布没有认证接口，访客始终匿名。
  const staticSite = useStaticSite()
  const currentUser = useState<CurrentUser | null>('current-user', () => null)
  const accessToken = useState<string | null>('auth-access-token', () => null)
  const initialized = useState('auth-initialized', () => false)
  const authError = useState('auth-error', () => '')
  // 最近一次失败是否为登录过期（401）；按种类判断，不比较随界面语言变化的提示文案
  const authExpired = useState('auth-expired', () => false)
  // 在调用时的同步阶段取翻译函数，刷新与恢复的失败分支都在 await 之后
  const t = currentTranslate()
  const restoringPending = useState('auth-restoring', () => false)
  const isLoggedIn = computed(() => currentUser.value !== null && accessToken.value !== null)

  function accept(payload: AuthPayload) {
    // 换账号整体撤销；从匿名进入登录态时公开栏目结果不变，只撤销按身份区分的状态
    if (currentUser.value && currentUser.value.id !== payload.user.id) invalidatePublicReads(nuxtApp)
    else if (!currentUser.value) invalidateIdentityReads(nuxtApp)
    if (currentUser.value && currentUser.value.id !== payload.user.id) {
      clearCommentDrafts(nuxtApp)
      clearMomentDrafts(nuxtApp)
    }
    accessToken.value = payload.accessToken
    currentUser.value = {
      id: payload.user.id,
      nickname: payload.user.username,
      email: '',
      avatar: '/avatar.svg',
      role: 'owner',
    }
    authError.value = ''
    authExpired.value = false
  }
  async function login(username: string, password: string) {
    const result = await withAuthCookieLock(() =>
      $fetch<{ code: number; data: AuthPayload }>('/api/v1/auth/login', {
        method: 'POST',
        body: { username, password },
        keepalive: true,
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
          keepalive: true,
          credentials: 'include',
          retry: 0,
          timeout: 10000,
        })
        accept(result.data)
        return true
      } catch (cause) {
        const status = (cause as { statusCode?: number }).statusCode
        if (status === 401) {
          if (currentUser.value) {
            invalidatePublicReads(nuxtApp)
            clearCommentDrafts(nuxtApp)
            clearMomentDrafts(nuxtApp)
          }
          currentUser.value = null
          accessToken.value = null
        }
        authExpired.value = status === 401
        authError.value = t(status === 401 ? 'admin-system.auth.expired' : 'admin-system.auth.unconfirmed')
        return false
      } finally {
        refreshing = null
      }
    })
    return refreshing
  }
  async function restore() {
    if (import.meta.server || initialized.value) return isLoggedIn.value
    if (staticSite) {
      initialized.value = true
      return false
    }
    if (restoring) return restoring
    restoringPending.value = true
    restoring = (async () => {
      try {
        const result = await withAuthCookieRead(() =>
          $fetch<{ data: { authenticated: boolean } }>('/api/v1/auth/session', {
            credentials: 'include',
            retry: 0,
            timeout: 10000,
          }),
        )
        if (result.data.authenticated) {
          const restored = await refresh()
          initialized.value = restored || authExpired.value
        } else {
          // 成功确认匿名状态即结束先前的临时读取错误，不把匿名误判为认证失败。
          initialized.value = true
          authError.value = ''
          authExpired.value = false
        }
      } catch {
        authExpired.value = false
        authError.value = t('admin-system.auth.unconfirmed')
      }
      return isLoggedIn.value
    })()
    try {
      return await restoring
    } finally {
      restoring = null
      restoringPending.value = false
    }
  }
  async function clearSession(message = '') {
    loggingOut = true
    try {
      if (refreshing) await refreshing
      invalidatePublicReads(nuxtApp)
      clearCommentDrafts(nuxtApp)
      clearMomentDrafts(nuxtApp)
      currentUser.value = null
      accessToken.value = null
      initialized.value = true
      authError.value = message
      authExpired.value = false
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
          keepalive: true,
          credentials: 'include',
          headers: accessToken.value ? { Authorization: `Bearer ${accessToken.value}` } : {},
          retry: 0,
          timeout: 10000,
        }),
      )
      invalidatePublicReads(nuxtApp)
      clearCommentDrafts(nuxtApp)
      currentUser.value = null
      clearMomentDrafts(nuxtApp)
      accessToken.value = null
      initialized.value = true
    } finally {
      loggingOut = false
    }
  }
  return {
    currentUser,
    accessToken,
    initialized,
    authError,
    isLoggedIn,
    restoringPending,
    login,
    restore,
    refresh,
    logout,
    clearSession,
  }
}
