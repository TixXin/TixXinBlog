/** @file usePromptRepository.ts @description 提示词真实公开读取与经过认证的管理写入 */
import type {
  ImagePrompt,
  ManagedPrompt,
  PromptForm,
  PromptMetadata,
  PromptPage,
  PromptQuery,
  PromptConflictKind,
  PromptRequestError,
} from '~/features/prompt/types'
import { promptPayload } from '~/features/prompt/editor'
export function usePromptRepository() {
  const base = String(useRuntimeConfig().public.apiBaseUrl).replace(/\/$/, ''),
    admin = useAdminApi()
  function failure(value: unknown): PromptRequestError {
    const cause = value as { statusCode?: number; status?: number; data?: { message?: unknown }; message?: string }
    const statusCode = cause?.statusCode ?? cause?.status
    const sourceMessage =
      typeof cause?.data?.message === 'string'
        ? cause.data.message.trim()
        : typeof cause?.message === 'string' && !/^\[[A-Z]+\]\s/.test(cause.message)
          ? cause.message.trim()
          : ''
    // 409 同时用于版本、内容库和创建去重；只有服务端明确的版本提示允许进入合并流程。
    let conflictKind: PromptConflictKind | undefined
    if (statusCode === 409) {
      conflictKind =
        sourceMessage === '提示词已被修改，请保留输入并重新读取'
          ? 'revision'
          : /^(站点数据上下文已变化|站点数据已恢复|登录账号或内容库已变化)/.test(sourceMessage)
            ? 'context'
            : sourceMessage === '此提交已处理，请核查原提示词'
              ? 'submission'
              : 'unknown'
    }
    let conflictMessage = sourceMessage || '操作发生冲突，请核对当前状态后重试'
    if (conflictKind === 'context' && !conflictMessage.includes('刷新'))
      conflictMessage += '；请保留当前输入，刷新页面后重新打开编辑器。'
    else if (!/保留.*输入|输入.*保留/.test(conflictMessage)) conflictMessage += '；当前输入已保留。'
    const message =
      statusCode === 409
        ? conflictMessage
        : statusCode === 401
          ? '登录已失效，请重新登录后重试；当前输入已保留。'
          : statusCode === 404
            ? '这份提示词不存在或尚未公开。'
            : !statusCode || statusCode >= 500
              ? '提示词服务暂时不可用，请稍后重试。'
              : typeof cause.data?.message === 'string'
                ? cause.data.message
                : '操作未完成，请核对输入后重试。'
    return Object.assign(new Error(message, { cause: value }), { statusCode, conflictKind })
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
