/** @file useSubscriptionRepository.ts @description 订阅真实接口，公开统计与管理认证请求分离 */
import type {
  ManagedSubscription,
  SubscriptionEditable,
  SubscriptionItem,
  SubscriptionPage,
  SubscriptionQuery,
  SubscriptionStats,
} from '~/features/subscription/types'
export function useSubscriptionRepository() {
  const base = String(useRuntimeConfig().public.apiBaseUrl).replace(/\/$/, ''),
    admin = useAdminApi()
  function failure(value: unknown) {
    const cause = value as { statusCode?: number; status?: number; data?: { message?: unknown } },
      statusCode = cause?.statusCode ?? cause?.status
    const message =
      !statusCode || statusCode >= 500
        ? '订阅服务暂时不可用，请稍后重试'
        : typeof cause.data?.message === 'string'
          ? cause.data.message
          : statusCode === 404
            ? '订阅不存在或尚未公开'
            : cause instanceof Error
              ? cause.message
              : '操作未完成，请核对输入后重试'
    // 与提示词编辑器一致：内容库409不能误作同一记录的版本合并。
    const conflictKind =
      statusCode !== 409
        ? undefined
        : message === '订阅已被修改，请保留输入并重新读取'
          ? 'revision'
          : /^(站点数据上下文已变化|站点数据已恢复|登录账号或内容库已变化)/.test(message)
            ? 'context'
            : message === '此提交已处理，请核查原订阅'
              ? 'submission'
              : 'unknown'
    return Object.assign(new Error(message, { cause: value }), { statusCode, conflictKind })
  }
  async function read<T>(path: string, query?: SubscriptionQuery, signal?: AbortSignal): Promise<T> {
    try {
      const result = await $fetch<{ code: number; data: T }>(base + path, {
        query: query ? { ...query } : undefined,
        signal,
        timeout: 10000,
        retry: 0,
      })
      if (result.code !== 0) throw new Error('订阅读取未完成')
      return result.data
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
  return {
    list: (query: SubscriptionQuery, signal?: AbortSignal) => read<SubscriptionPage>('/subscriptions', query, signal),
    stats: (query: SubscriptionQuery, signal?: AbortSignal) =>
      read<SubscriptionStats>('/subscriptions/stats', query, signal),
    detail: (id: number, signal?: AbortSignal) => read<SubscriptionItem>(`/subscriptions/${id}`, undefined, signal),
    adminList: (query: SubscriptionQuery & { status?: string }) =>
      manage<SubscriptionPage<ManagedSubscription>>('/admin/subscriptions', { query: { ...query } }),
    adminDetail: (id: number) => manage<ManagedSubscription>(`/admin/subscriptions/${id}`),
    submission: (requestId: string) =>
      manage<{ state: 'saved'; item: ManagedSubscription } | { state: 'deleted'; id: number }>(
        `/admin/subscriptions/submissions/${requestId}`,
      ),
    save: (body: SubscriptionEditable, requestId: string, id?: number, revision?: number) =>
      id
        ? manage<ManagedSubscription>(`/admin/subscriptions/${id}`, { method: 'PATCH', body: { ...body, revision } })
        : manage<ManagedSubscription>('/admin/subscriptions', { method: 'POST', body: { ...body, requestId } }),
    update: (id: number, body: Partial<SubscriptionEditable>, revision: number) =>
      manage<ManagedSubscription>(`/admin/subscriptions/${id}`, { method: 'PATCH', body: { ...body, revision } }),
    remove: (id: number, revision: number) =>
      manage<{ ok: boolean }>(`/admin/subscriptions/${id}`, { method: 'DELETE', query: { revision } }),
    sort: (items: { id: number; revision: number; sortOrder: number }[]) =>
      manage('/admin/subscriptions/sort', { method: 'PATCH', body: { items } }),
    favicon: (url: string) =>
      manage<{ domain: string; faviconUrl: string | null }>('/admin/subscriptions/fetch-favicon', {
        method: 'POST',
        body: { url },
      }),
  }
}
