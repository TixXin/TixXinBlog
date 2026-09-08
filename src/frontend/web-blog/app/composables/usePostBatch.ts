/**
 * @file usePostBatch.ts
 * @description 批量预览和执行分离；失败保留凭证，允许查询结果及幂等续办。
 */
import type { PostBatchAction, PostBatchPreview, PostBatchResult, PostSelection } from '~/features/post/batchTypes'

export function usePostBatch(onChanged: () => Promise<void>) {
  const api = useAdminApi()
  const preview = ref<PostBatchPreview | null>(null)
  const result = ref<PostBatchResult | null>(null)
  const pending = ref(false)
  const error = ref('')
  const open = ref(false)
  const attempted = ref(false)
  const acknowledgement = ref('')
  const recent = ref<
    { ticket: string; action: PostBatchAction; createdAt: string; count: number; completed: boolean }[]
  >([])
  const recentError = ref('')
  async function loadRecent() {
    recentError.value = ''
    try {
      recent.value = await api('/admin/posts/batch')
    } catch {
      recentError.value = '最近批量操作加载失败'
    }
  }
  function message(cause: unknown, fallback: string) {
    const detail = (cause as { data?: { message?: unknown } }).data?.message
    return typeof detail === 'string' ? detail : fallback
  }
  async function review(action: PostBatchAction, items: PostSelection[]) {
    if (pending.value || !items.length) return
    pending.value = true
    error.value = ''
    preview.value = null
    result.value = null
    attempted.value = false
    acknowledgement.value = ''
    open.value = true
    try {
      preview.value = await api<PostBatchPreview>('/admin/posts/batch/preview', {
        method: 'POST',
        body: { action, items },
      })
    } catch (cause) {
      error.value = message(cause, '预览失败，请关闭后重新预览；尚未执行批量修改')
    } finally {
      pending.value = false
    }
  }
  async function receive(value: PostBatchResult) {
    result.value = value
    preview.value = value.preview
    await loadRecent()
    if (value.results.length) {
      clearNuxtData((key) => key.startsWith('article-') || key.startsWith('post-'))
      await onChanged()
    }
  }
  async function inspect(ticket: string) {
    if (pending.value) return
    preview.value = null
    result.value = null
    open.value = true
    pending.value = true
    attempted.value = true
    acknowledgement.value = ''
    error.value = ''
    try {
      await receive(await api<PostBatchResult>(`/admin/posts/batch/${ticket}`))
    } catch (cause) {
      error.value = message(cause, '操作记录加载失败，请关闭后重试')
    } finally {
      pending.value = false
    }
  }
  async function execute() {
    if (pending.value || !preview.value || result.value?.completed) return
    pending.value = true
    attempted.value = true
    error.value = ''
    try {
      await receive(
        await api<PostBatchResult>('/admin/posts/batch/execute', {
          method: 'POST',
          body: { ticket: preview.value.ticket, acknowledgement: acknowledgement.value },
          timeout: 60000,
        }),
      )
    } catch (cause) {
      error.value = message(cause, '未收到完整执行结果。请查询结果，或使用同一凭证继续执行；已处理条目不会重复修改。')
    } finally {
      pending.value = false
    }
  }
  async function queryResult() {
    if (pending.value || !preview.value) return
    pending.value = true
    error.value = ''
    try {
      await receive(await api<PostBatchResult>(`/admin/posts/batch/${preview.value.ticket}`))
    } catch (cause) {
      error.value = message(cause, '结果查询失败，凭证仍保留，可重试')
    } finally {
      pending.value = false
    }
  }
  return {
    preview,
    result,
    pending,
    error,
    open,
    attempted,
    acknowledgement,
    review,
    execute,
    queryResult,
    recent,
    recentError,
    loadRecent,
    inspect,
  }
}
