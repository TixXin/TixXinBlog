/**
 * @file useAdminApi.ts
 * @description 管理接口统一认证和单次刷新重试；认证失败不伪装为成功
 */
import { ensureVisitorId } from '~/utils/visitorId'

export function useAdminApi() {
  const auth = useCurrentUser()
  const pageContext = useState<string>('page-content-context', () => '')
  return async function adminApi<T>(
    path: string,
    options: {
      method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
      body?: unknown
      query?: Record<string, string | number | undefined>
      timeout?: number
    } = {},
  ): Promise<T> {
    if (import.meta.server) throw new Error('管理接口需要客户端登录')
    const originalActor = auth.currentUser.value?.id
    const originalContext = pageContext.value
    // 发起时冻结正文；身份恢复与令牌刷新不会重新读取编辑器中随后变化的内容。
    const requestOptions = {
      ...options,
      query: options.query ? { ...options.query } : undefined,
      body: options.body === undefined ? undefined : JSON.parse(JSON.stringify(options.body)),
    }
    const ownershipError = () =>
      Object.assign(new Error('登录账号或内容库已变化，请保留输入并重新核对后操作'), { statusCode: 409 })
    await auth.restore()
    const actor = auth.currentUser.value?.id
    if ((originalActor && actor !== originalActor) || pageContext.value !== originalContext) throw ownershipError()
    if (!actor) throw Object.assign(new Error('请先登录博主账号，未保存内容仍保留'), { statusCode: 401 })
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
              await auth.clearSession('登录已失效，请重新登录后重试；未保存内容仍保留在页面')
            throw retryCause
          }
        }
      }
      throw cause
    }
  }
}
