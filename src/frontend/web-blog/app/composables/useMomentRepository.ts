/** @file useMomentRepository.ts @description 朋友圈同源 HTTP 仓储，失败使用可读提示并保留状态码 */
import type { MomentRepository } from '~/features/moment/repository'
import { ensureVisitorId } from '~/utils/visitorId'

export function useMomentRepository(): MomentRepository {
  const base = String(useRuntimeConfig().public.apiBaseUrl).replace(/\/$/, '')
  const admin = useAdminApi()
  const pageContext = useState<string>('page-content-context', () => '')
  function failure(cause: unknown): Error {
    const error = cause as { statusCode?: number; status?: number; data?: { message?: unknown } }
    const statusCode = error?.statusCode ?? error?.status
    const message =
      !statusCode || statusCode >= 500
        ? '朋友圈服务暂时不可用，请稍后重试'
        : typeof error.data?.message === 'string'
          ? error.data.message
          : statusCode === 404
            ? '动态不存在或尚未公开'
            : '操作未完成，请检查输入后重试'
    return Object.assign(new Error(message, { cause }), { statusCode })
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
      const response = await $fetch<{ code: number; data: T; message: string }>(base + path, {
        ...options,
        body: options.body as Record<string, unknown> | undefined,
        headers: {
          ...(visitor ? { 'X-Visitor-Id': visitor } : {}),
          ...(pageContext.value ? { 'X-Content-Context': pageContext.value } : {}),
        },
        retry: 0,
        timeout: 10000,
      })
      if (response.code !== 0) throw new Error('朋友圈请求未成功')
      return response.data
    } catch (cause) {
      throw failure(cause)
    }
  }
  async function manage<T>(path: string, options?: Parameters<typeof admin>[1]): Promise<T> {
    try {
      return await admin<T>(path, options)
    } catch (cause) {
      throw failure(cause)
    }
  }
  const path = (id: string) => `/moments/${encodeURIComponent(id)}`
  return {
    list: (query, signal) => request('/moments', { query: { ...query }, signal }),
    detail: (id, signal) => request(path(id), { signal }),
    overview: (signal) => request('/moments/overview', { signal }),
    navigation: (id, signal) => request(path(id) + '/navigation', { signal }),
    comments: (id, page, signal) => request(path(id) + '/comments', { query: { page, pageSize: 15 }, signal }),
    like: (id, liked) => request(path(id) + '/like', { method: 'PUT', body: { liked } }),
    comment: (id, value, owner) =>
      owner
        ? manage('/admin' + path(id) + '/comments', {
            method: 'POST',
            body: { content: value.content, requestId: value.requestId },
          })
        : request(path(id) + '/comments', { method: 'POST', body: value }),
    adminList: (query) => manage('/admin/moments', { query: { ...query } }),
    adminDetail: (id) => manage('/admin' + path(id)),
    submission: (requestId) => manage('/admin/moments/submissions/' + encodeURIComponent(requestId)),
    update: (id, patch, revision) => manage('/admin' + path(id), { method: 'PATCH', body: { ...patch, revision } }),
    save: (value, requestId, id, revision) =>
      manage(id ? '/admin' + path(id) : '/admin/moments', {
        method: id ? 'PATCH' : 'POST',
        body: { ...value, ...(id ? { revision } : { requestId }) },
      }),
    remove: (id, revision) => manage('/admin' + path(id), { method: 'DELETE', query: { revision } }),
    adminComments: (id, page) => manage('/admin' + path(id) + '/comments', { query: { page, pageSize: 15 } }),
    moderate: (id, commentId, status, expectedStatus) =>
      manage('/admin' + path(id) + `/comments/${encodeURIComponent(commentId)}`, {
        method: 'PATCH',
        body: { status, expectedStatus },
      }),
    removeComment: (id, commentId) =>
      manage('/admin' + path(id) + `/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE' }),
  }
}
