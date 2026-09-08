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
    await auth.restore()
    const send = () =>
      $fetch<{ code: number; data: T }>(`/api/v1${path}`, {
        ...options,
        body: options.body as Record<string, unknown> | undefined,
        headers: {
          'X-Visitor-Id': ensureVisitorId(),
          ...(pageContext.value ? { 'X-Content-Context': pageContext.value } : {}),
          ...(auth.accessToken.value ? { Authorization: `Bearer ${auth.accessToken.value}` } : {}),
        },
        credentials: 'include',
        retry: 0,
        timeout: options.timeout ?? 10000,
      })
    try {
      return (await send()).data
    } catch (cause) {
      if ((cause as { statusCode?: number }).statusCode === 401) {
        if (await auth.refresh()) {
          try {
            return (await send()).data
          } catch (retryCause) {
            if ((retryCause as { statusCode?: number }).statusCode === 401)
              await auth.clearSession('登录已失效，请重新登录后重试；未保存内容仍保留在页面')
            throw retryCause
          }
        }
      }
      throw cause
    }
  }
}
