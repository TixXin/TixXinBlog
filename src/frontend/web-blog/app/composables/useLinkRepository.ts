/** @file useLinkRepository.ts @description 真实友链仓储，不抓取站点信息，不在错误时回退演示记录 */
import type {
  LinkEditable,
  LinkItem,
  LinkMetadata,
  LinkPage,
  LinkQuery,
  LinkSettings,
  ManagedLink,
} from '~/features/link/types'
export function useLinkRepository() {
  const base = String(useRuntimeConfig().public.apiBaseUrl).replace(/\/$/, ''),
    admin = useAdminApi(),
    // 错误文案在失败时按当前语言生成；4xx 优先显示后端 message
    t = currentTranslate()
  function failure(value: unknown) {
    const cause = value as { statusCode?: number; status?: number },
      statusCode = cause?.statusCode ?? cause?.status
    const message =
      !statusCode || statusCode >= 500
        ? t('interaction.links.serviceUnavailable')
        : apiErrorMessage(value, statusCode === 404 ? 'interaction.links.notFound' : 'interaction.links.invalid', { t })
    return Object.assign(new Error(message, { cause: value }), { statusCode })
  }
  async function read<T>(path: string, query?: LinkQuery, signal?: AbortSignal): Promise<T> {
    try {
      const result = await $fetch<{ code: number; data: T }>(base + path, {
        query: query ? { ...query } : undefined,
        signal,
        timeout: 10000,
        retry: 0,
      })
      if (result.code !== 0) throw new Error(t('interaction.links.requestIncomplete'))
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
    list: (query: LinkQuery, signal?: AbortSignal) => read<LinkPage>('/links', query, signal),
    detail: (id: number, signal?: AbortSignal) => read<LinkItem>(`/links/${id}`, undefined, signal),
    metadata: (signal?: AbortSignal) => read<LinkMetadata>('/links/metadata', undefined, signal),
    adminList: (query: LinkQuery & { status?: string }) =>
      manage<LinkPage<ManagedLink>>('/admin/links', { query: { ...query } }),
    adminDetail: (id: number) => manage<ManagedLink>(`/admin/links/${id}`),
    submission: (requestId: string) =>
      manage<{ state: 'saved'; item: ManagedLink } | { state: 'deleted'; id: number }>(
        `/admin/links/submissions/${requestId}`,
      ),
    save: (body: LinkEditable, requestId: string, id?: number, revision?: number) =>
      id
        ? manage<ManagedLink>(`/admin/links/${id}`, { method: 'PATCH', body: { ...body, revision } })
        : manage<ManagedLink>('/admin/links', { method: 'POST', body: { ...body, requestId } }),
    update: (id: number, body: Partial<LinkEditable>, revision: number) =>
      manage<ManagedLink>(`/admin/links/${id}`, { method: 'PATCH', body: { ...body, revision } }),
    remove: (id: number, revision: number) =>
      manage<{ ok: boolean }>(`/admin/links/${id}`, { method: 'DELETE', query: { revision } }),
    settings: () => manage<LinkSettings>('/admin/links/settings'),
    saveSettings: (body: Pick<LinkSettings, 'rules' | 'revision'>) =>
      manage<LinkSettings>('/admin/links/settings', { method: 'PATCH', body }),
  }
}
