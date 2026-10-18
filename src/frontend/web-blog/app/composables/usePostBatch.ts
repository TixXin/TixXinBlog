/**
 * @file usePostBatch.ts
 * @description 分批预览和执行分离；失败保留凭证，允许查询结果及幂等续办。
 */
import { invalidatePublicReads } from '~/utils/invalidatePublicReads'
import { POST_BATCH_LIMIT, POST_SELECTION_LIMIT } from '~/features/post/batchTypes'
import type { PostBatchAction, PostBatchPreview, PostBatchResult, PostSelection } from '~/features/post/batchTypes'

export function usePostBatch(onChanged: (result: PostBatchResult) => Promise<void>) {
  const app = useNuxtApp()
  const api = useAdminApi()
  const { currentUser } = useCurrentUser()
  const context = useState<string>('page-content-context', () => '')
  const preview = ref<PostBatchPreview | null>(null)
  const result = ref<PostBatchResult | null>(null)
  const pending = ref(false)
  const error = ref('')
  const open = ref(false)
  const attempted = ref(false)
  const queried = ref(false)
  const acknowledgement = ref('')
  const batches = shallowRef<PostSelection[][]>([])
  const queueAction = ref<PostBatchAction | null>(null)
  const position = ref(0)
  const batchIndex = computed(() => position.value + 1)
  const batchCount = computed(() => Math.max(1, batches.value.length))
  const totalCount = computed(() =>
    batches.value.length
      ? batches.value.reduce((sum, items) => sum + items.length, 0)
      : (preview.value?.items.length ?? 0),
  )
  const hasNext = computed(() => position.value + 1 < batches.value.length)
  const canNext = computed(
    () =>
      !pending.value &&
      batches.value.length > 0 &&
      (!preview.value || (hasNext.value && (!!result.value?.completed || preview.value.allowedCount === 0))),
  )
  const recent = ref<
    { ticket: string; action: PostBatchAction; createdAt: string; count: number; completed: boolean }[]
  >([])
  const recentError = ref('')
  let generation = 0,
    recentGeneration = 0,
    alive = true
  function owns(version: number) {
    return alive && version === generation
  }
  function clearQueue() {
    batches.value = []
    queueAction.value = null
    position.value = 0
  }
  function resetPreview() {
    preview.value = null
    result.value = null
    attempted.value = false
    queried.value = false
    acknowledgement.value = ''
    error.value = ''
  }
  watch(
    [() => currentUser.value?.id, context],
    () => {
      generation++
      recentGeneration++
      clearQueue()
      resetPreview()
      pending.value = false
      open.value = false
      recent.value = []
      recentError.value = ''
    },
    { flush: 'sync' },
  )
  onScopeDispose(() => {
    alive = false
    generation++
    recentGeneration++
  })
  async function loadRecent() {
    if (!alive) return
    const version = generation,
      request = ++recentGeneration
    recentError.value = ''
    try {
      const value = await api<typeof recent.value>('/admin/posts/batch')
      if (owns(version) && request === recentGeneration) recent.value = value
    } catch {
      if (owns(version) && request === recentGeneration) recentError.value = '最近批量操作加载失败'
    }
  }
  function message(cause: unknown, fallback: string) {
    const detail = (cause as { data?: { message?: unknown } }).data?.message
    return typeof detail === 'string' ? detail : fallback
  }
  function keepUnfinishedTicket() {
    if (!attempted.value || !preview.value || result.value?.completed) return false
    if (queried.value && result.value && preview.value.expiresIn <= 0) return false
    open.value = true
    error.value = '当前批次尚未确认结束，请先查询结果或使用原凭证继续执行，再发起其他批量操作。'
    return true
  }
  async function previewCurrent() {
    const action = queueAction.value,
      items = batches.value[position.value]
    if (!alive || pending.value || !action || !items) return
    const version = ++generation
    pending.value = true
    resetPreview()
    try {
      const value = await api<PostBatchPreview>('/admin/posts/batch/preview', {
        method: 'POST',
        body: { action, items },
      })
      if (owns(version)) preview.value = value
    } catch (cause) {
      if (owns(version)) error.value = message(cause, '本批预览失败，尚未执行；可重试本批，已完成批次不会重复提交。')
    } finally {
      if (owns(version)) pending.value = false
    }
  }
  async function review(action: PostBatchAction, items: PostSelection[]) {
    if (!alive || pending.value || !items.length || keepUnfinishedTicket()) return
    open.value = true
    if (items.length > POST_SELECTION_LIMIT) {
      clearQueue()
      resetPreview()
      error.value = `一次最多选择 ${POST_SELECTION_LIMIT} 篇，请缩小范围后重试。`
      return
    }
    clearQueue()
    queueAction.value = action
    // 冻结编号与版本，后续翻页或选择变化不会改写已确认的队列。
    const frozen = items.map(({ id, revision }) => ({ id, revision }))
    for (let offset = 0; offset < frozen.length; offset += POST_BATCH_LIMIT) {
      batches.value.push(frozen.slice(offset, offset + POST_BATCH_LIMIT))
    }
    // shallowRef 只追踪数组替换，组装完成后一次性发布。
    batches.value = [...batches.value]
    await previewCurrent()
  }
  async function nextBatch() {
    if (!alive || !canNext.value) return
    if (preview.value) position.value++
    await previewCurrent()
  }
  async function receive(value: PostBatchResult, version: number) {
    if (!owns(version)) return
    result.value = value
    preview.value = value.preview
    await loadRecent()
    if (!owns(version) || !value.results.length) return
    invalidatePublicReads(app, ['posts', 'post-summary', 'archive', 'moment-feed'])
    clearNuxtData((key) => key.startsWith('article-') || key.startsWith('post-'))
    try {
      await onChanged(value)
    } catch {
      if (owns(version)) error.value = '批量结果已收到，但文章列表刷新失败，请刷新列表后核对。'
    }
  }
  async function inspect(ticket: string) {
    if (!alive || pending.value) return
    if (preview.value?.ticket === ticket) {
      open.value = true
      await queryResult()
      return
    }
    if (keepUnfinishedTicket()) return
    clearQueue()
    resetPreview()
    const version = ++generation
    open.value = true
    pending.value = true
    attempted.value = true
    try {
      await receive(await api<PostBatchResult>(`/admin/posts/batch/${ticket}`), version)
      if (owns(version)) queried.value = true
    } catch (cause) {
      if (owns(version)) error.value = message(cause, '操作记录加载失败，请关闭后重试')
    } finally {
      if (owns(version)) pending.value = false
    }
  }
  async function execute() {
    if (
      !alive ||
      pending.value ||
      !preview.value ||
      result.value?.completed ||
      !preview.value.allowedCount ||
      preview.value.expiresIn <= 0 ||
      (preview.value.action === 'delete' && acknowledgement.value !== '永久删除')
    )
      return
    const version = ++generation
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
        version,
      )
    } catch (cause) {
      if (owns(version))
        error.value = message(cause, '未收到完整执行结果。请查询结果，或使用同一凭证继续执行；已处理条目不会重复修改。')
    } finally {
      if (owns(version)) pending.value = false
    }
  }
  async function queryResult() {
    if (!alive || pending.value || !preview.value) return
    const version = ++generation
    pending.value = true
    error.value = ''
    try {
      await receive(await api<PostBatchResult>(`/admin/posts/batch/${preview.value.ticket}`), version)
      if (owns(version)) queried.value = true
    } catch (cause) {
      if (owns(version)) error.value = message(cause, '结果查询失败，凭证仍保留，可重试')
    } finally {
      if (owns(version)) pending.value = false
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
    batchIndex,
    batchCount,
    totalCount,
    hasNext,
    canNext,
    nextBatch,
    review,
    execute,
    queryResult,
    recent,
    recentError,
    loadRecent,
    inspect,
  }
}
