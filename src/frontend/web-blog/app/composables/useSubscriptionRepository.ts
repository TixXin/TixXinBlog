/** @file useSubscriptionRepository.ts @description 订阅真实接口，公开统计与管理认证请求分离 */
import type {
  ManagedSubscription,
  SubscriptionEditable,
  SubscriptionItem,
  SubscriptionPage,
  SubscriptionQuery,
  SubscriptionStats,
} from '~/features/subscription/types'
import { apiConflictKind } from '~/utils/apiError'
export function useSubscriptionRepository() {
  const base = String(useRuntimeConfig().public.apiBaseUrl).replace(/\/$/, ''),
    admin = useAdminApi(),
    t = currentTranslate()
  function failure(value: unknown) {
    const cause = value as { statusCode?: number; status?: number; data?: { message?: unknown } },
      statusCode = cause?.statusCode ?? cause?.status
    // 5xx 一律显示友好文案，只信任 4xx 的后端 message；按调用时的界面语言取兜底文案。
    const message =
      !statusCode || statusCode >= 500
        ? t('misc.subscription.repository.unavailable')
        : typeof cause.data?.message === 'string'
          ? cause.data.message
          : statusCode === 404
            ? t('misc.subscription.repository.notFound')
            : cause instanceof Error
              ? cause.message
              : t('misc.subscription.repository.incomplete')
    // 与提示词编辑器一致：内容库409不能误作同一记录的版本合并；按业务码与 ownershipChanged 判断，不比对文案。
    const conflictKind = statusCode === 409 ? apiConflictKind(value) : undefined
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
      if (result.code !== 0) throw new Error(t('misc.subscription.repository.readIncomplete'))
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
