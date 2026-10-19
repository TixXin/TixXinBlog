/** @file useGuestbookRepository.ts @description 留言同源API仓储，公开写入携带访客及内容上下文，不回退演示数据 */
import type { GuestbookRepository } from '~/features/guestbook/repository'
import { ensureVisitorId } from '~/utils/visitorId'
export function useGuestbookRepository(): GuestbookRepository {
  const base = String(useRuntimeConfig().public.apiBaseUrl).replace(/\/$/, '')
  const admin = useAdminApi()
  const contentContext = useState('page-content-context', () => '')
  // 错误文案在失败时按当前语言生成；4xx 优先显示后端 message
  const t = currentTranslate()
  function failure(value: unknown) {
    const cause = value as { statusCode?: number; status?: number }
    const statusCode = cause?.statusCode ?? cause?.status
    const message =
      !statusCode || statusCode >= 500
        ? t('interaction.guestbookSession.serviceUnavailable')
        : apiErrorMessage(
            value,
            statusCode === 404 ? 'interaction.guestbookSession.notFound' : 'interaction.guestbookSession.invalid',
            { t },
          )
    return Object.assign(new Error(message, { cause: value }), { statusCode })
  }
  async function request<T>(
    path: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT'
      body?: unknown
      query?: Record<string, unknown>
      signal?: AbortSignal
    } = {},
  ): Promise<T> {
    try {
      const visitor = ensureVisitorId()
      const response = await $fetch<{ code: number; data: T }>(base + path, {
        ...options,
        body: options.body as Record<string, unknown> | undefined,
        headers: {
          ...(visitor ? { 'X-Visitor-Id': visitor } : {}),
          ...(contentContext.value ? { 'X-Content-Context': contentContext.value } : {}),
        },
        retry: 0,
        timeout: 10000,
      })
      if (response.code !== 0) throw new Error(t('interaction.guestbookSession.requestIncomplete'))
      return response.data
    } catch (error) {
      throw failure(error)
    }
  }
  async function manage<T>(path: string, options?: Parameters<typeof admin>[1]): Promise<T> {
    try {
      return await admin<T>(path, options)
    } catch (error) {
      throw failure(error)
    }
  }
  return {
    list: (query, signal) => request('/guestbook', { query: { ...query }, signal }),
    metadata: (signal) => request('/guestbook/metadata', { signal }),
    detail: (id, signal) => request(`/guestbook/${id}`, { signal }),
    create: (body, owner) =>
      owner
        ? manage('/admin/guestbook', {
            method: 'POST',
            body: { requestId: body.requestId, content: body.content, replyToId: body.replyToId ?? null },
          })
        : request('/guestbook', { method: 'POST', body }),
    react: (id, emoji, reacted) => request(`/guestbook/${id}/reactions`, { method: 'PUT', body: { emoji, reacted } }),
    adminList: (query) => manage('/admin/guestbook', { query }),
    adminDetail: (id) => manage(`/admin/guestbook/${id}`),
    update: (id, body) => manage(`/admin/guestbook/${id}`, { method: 'PATCH', body }),
    remove: (id, revision) => manage(`/admin/guestbook/${id}`, { method: 'DELETE', query: { revision } }),
  }
}
