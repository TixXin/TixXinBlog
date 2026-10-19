/**
 * @file useAdminApi.ts
 * @description 管理接口统一认证和单次刷新重试；认证失败不伪装为成功
 */
import { invalidatePublicWrite } from '~/utils/invalidatePublicReads'
import { ensureVisitorId } from '~/utils/visitorId'

export function useAdminApi() {
  const auth = useCurrentUser()
  const app = useNuxtApp()
  const pageContext = useState<string>('page-content-context', () => '')
  // 在 setup 同步阶段取翻译函数；下列错误都在 await 之后抛出
  const t = currentTranslate()
  return async function adminApi<T>(
    path: string,
    options: {
      method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
      body?: unknown
      query?: Record<string, string | number | undefined>
      timeout?: number
    } = {},
  ): Promise<T> {
    if (import.meta.server) throw new Error(t('admin-system.auth.clientOnly'))
    const originalActor = auth.currentUser.value?.id
    const originalContext = pageContext.value
    // 发起时冻结正文；身份恢复与令牌刷新不会重新读取编辑器中随后变化的内容。
    const requestOptions = {
      ...options,
      query: options.query ? { ...options.query } : undefined,
      body: options.body === undefined ? undefined : JSON.parse(JSON.stringify(options.body)),
    }
    const ownershipError = () =>
      // ownershipChanged 供调用方按种类识别，不依赖随界面语言变化的提示文案
      Object.assign(new Error(t('admin-system.auth.ownershipChanged')), { statusCode: 409, ownershipChanged: true })
    await auth.restore()
    const actor = auth.currentUser.value?.id
    if ((originalActor && actor !== originalActor) || pageContext.value !== originalContext) throw ownershipError()
    if (!actor) throw Object.assign(new Error(t('admin-system.auth.loginRequired')), { statusCode: 401 })
    const assertOwnership = () => {
      if (auth.currentUser.value?.id !== actor || pageContext.value !== originalContext) throw ownershipError()
    }
    const send = async () => {
      assertOwnership()
      const result = await $fetch<{ code: number; data: T }>(`/api/v1${path}`, {
        ...requestOptions,
        body: requestOptions.body as Record<string, unknown> | undefined,
        headers: {
          'X-Visitor-Id': ensureVisitorId(),
          ...(originalContext ? { 'X-Content-Context': originalContext } : {}),
          ...(auth.accessToken.value ? { Authorization: `Bearer ${auth.accessToken.value}` } : {}),
        },
        credentials: 'include',
        retry: 0,
        timeout: options.timeout ?? 10000,
      })
      assertOwnership()
      if (options.method && options.method !== 'GET') invalidatePublicWrite(app, path)
      return result
    }
    try {
      return (await send()).data
    } catch (cause) {
      if ((cause as { statusCode?: number }).statusCode === 401) {
        assertOwnership()
        if (await auth.refresh()) {
          try {
            return (await send()).data
          } catch (retryCause) {
            if (
              (retryCause as { statusCode?: number }).statusCode === 401 &&
              auth.currentUser.value?.id === actor &&
              pageContext.value === originalContext
            )
              await auth.clearSession(t('admin-system.auth.sessionLost'))
            throw retryCause
          }
        }
      }
      throw cause
    }
  }
}
