/** @file usePromptRepository.ts @description 提示词真实公开读取与经过认证的管理写入 */
import type {
  ImagePrompt,
  ManagedPrompt,
  PromptForm,
  PromptMetadata,
  PromptPage,
  PromptQuery,
} from '~/features/prompt/types'
import { promptPayload } from '~/features/prompt/editor'
export function usePromptRepository() {
  const base = String(useRuntimeConfig().public.apiBaseUrl).replace(/\/$/, ''),
    admin = useAdminApi()
  function failure(value: unknown) {
    const cause = value as { statusCode?: number; status?: number; data?: { message?: unknown }; message?: string }
    const statusCode = cause?.statusCode ?? cause?.status
    const message =
      statusCode === 409
        ? '这份提示词已被更新，请核对服务器版本后合并；当前输入已保留。'
        : statusCode === 401
          ? '登录已失效，请重新登录后重试；当前输入已保留。'
          : statusCode === 404
            ? '这份提示词不存在或尚未公开。'
            : !statusCode || statusCode >= 500
              ? '提示词服务暂时不可用，请稍后重试。'
              : typeof cause.data?.message === 'string'
                ? cause.data.message
                : '操作未完成，请核对输入后重试。'
    return Object.assign(new Error(message, { cause: value }), { statusCode })
  }
  async function read<T>(path: string, query?: PromptQuery, signal?: AbortSignal): Promise<T> {
    try {
      const result = await $fetch<{ code: number; data: T }>(base + path, {
        query: query ? { ...query } : undefined,
        signal,
        timeout: 10000,
        retry: 0,
      })
      if (result.code !== 0) throw new Error('请求未完成')
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
    list: (query: PromptQuery, signal?: AbortSignal) => read<PromptPage>('/prompts', query, signal),
    metadata: (signal?: AbortSignal) => read<PromptMetadata>('/prompts/metadata', undefined, signal),
    detail: (id: number, signal?: AbortSignal) => read<ImagePrompt>(`/prompts/${id}`, undefined, signal),
    adminList: (query: PromptQuery & { status?: string }) =>
      manage<PromptPage<ManagedPrompt>>('/admin/prompts', { query: { ...query } }),
    adminDetail: (id: number) => manage<ManagedPrompt>(`/admin/prompts/${id}`),
    submission: (requestId: string) =>
      manage<{ state: 'saved'; item: ManagedPrompt }>(`/admin/prompts/submissions/${requestId}`),
    save: (form: PromptForm, requestId: string, id?: number, revision?: number) =>
      id
        ? manage<ManagedPrompt>(`/admin/prompts/${id}`, { method: 'PATCH', body: { ...promptPayload(form), revision } })
        : manage<ManagedPrompt>('/admin/prompts', { method: 'POST', body: { ...promptPayload(form), requestId } }),
  }
}
