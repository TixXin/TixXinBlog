/** @file useProjectRepository.ts @description 项目真实 API 仓储，公开读取与受保护管理写入分离 */
import type {
  ManagedProject,
  ProjectEditable,
  ProjectItem,
  ProjectMetadata,
  ProjectPage,
  ProjectQuery,
} from '~/features/project/types'
export function useProjectRepository() {
  const base = String(useRuntimeConfig().public.apiBaseUrl).replace(/\/$/, ''),
    admin = useAdminApi(),
    // 在创建时取翻译函数：失败处理发生在 await 之后，已脱离 Nuxt 上下文
    t = currentTranslate()
  function failure(value: unknown) {
    const cause = value as { statusCode?: number; status?: number; data?: { message?: unknown } },
      statusCode = cause?.statusCode ?? cause?.status
    const message =
      !statusCode || statusCode >= 500
        ? t('misc.project.repository.unavailable')
        : typeof cause.data?.message === 'string'
          ? cause.data.message
          : statusCode === 404
            ? t('misc.project.repository.notFound')
            : t('misc.shared.requestRejected')
    return Object.assign(new Error(message, { cause: value }), { statusCode })
  }
  async function read<T>(path: string, query?: ProjectQuery, signal?: AbortSignal): Promise<T> {
    try {
      const result = await $fetch<{ code: number; data: T }>(base + path, {
        query: query ? { ...query } : undefined,
        signal,
        timeout: 10000,
        retry: 0,
      })
      if (result.code !== 0) throw new Error(t('misc.project.repository.incomplete'))
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
    list: (query: ProjectQuery, signal?: AbortSignal) => read<ProjectPage>('/projects', query, signal),
    detail: (id: number, signal?: AbortSignal) => read<ProjectItem>(`/projects/${id}`, undefined, signal),
    metadata: (signal?: AbortSignal) => read<ProjectMetadata>('/projects/metadata', undefined, signal),
    adminList: (query: ProjectQuery & { status?: string }) =>
      manage<ProjectPage<ManagedProject>>('/admin/projects', { query: { ...query } }),
    adminDetail: (id: number) => manage<ManagedProject>(`/admin/projects/${id}`),
    submission: (requestId: string) =>
      manage<{ state: 'saved'; item: ManagedProject } | { state: 'deleted'; id: number }>(
        `/admin/projects/submissions/${requestId}`,
      ),
    save: (body: ProjectEditable, requestId: string, id?: number, revision?: number) =>
      id
        ? manage<ManagedProject>(`/admin/projects/${id}`, { method: 'PATCH', body: { ...body, revision } })
        : manage<ManagedProject>('/admin/projects', { method: 'POST', body: { ...body, requestId } }),
    update: (id: number, body: Partial<ProjectEditable>, revision: number) =>
      manage<ManagedProject>(`/admin/projects/${id}`, { method: 'PATCH', body: { ...body, revision } }),
    remove: (id: number, revision: number) =>
      manage<{ ok: boolean }>(`/admin/projects/${id}`, { method: 'DELETE', query: { revision } }),
  }
}
