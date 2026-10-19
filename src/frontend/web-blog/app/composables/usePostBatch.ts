/**
 * @file usePostBatch.ts
 * @description 分批预览和执行分离；失败保留凭证，允许查询结果及幂等续办。
 */
import { invalidatePublicReads } from '~/utils/invalidatePublicReads'
import { POST_BATCH_LIMIT, POST_DELETE_ACKNOWLEDGEMENT, POST_SELECTION_LIMIT } from '~/features/post/batchTypes'
import type { PostBatchAction, PostBatchPreview, PostBatchResult, PostSelection } from '~/features/post/batchTypes'

export function usePostBatch(onChanged: (result: PostBatchResult) => Promise<void>) {
  const app = useNuxtApp()
  const api = useAdminApi()
  const { t } = useI18n()
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
      if (owns(version) && request === recentGeneration) recentError.value = t('admin-content.postBatch.recentFailed')
    }
  }
  function message(cause: unknown, fallbackKey: string) {
    const key = `admin-content.postBatch.${fallbackKey}`
    // 校验管道返回的数组明细是字段级技术信息，批量面板只展示业务字符串 message，其余显示兜底说明。
    const detail = (cause as { data?: { message?: unknown } }).data?.message
    return typeof detail === 'string' ? apiErrorMessage(cause, key, { t }) : t(key)
  }
  function keepUnfinishedTicket() {
    if (!attempted.value || !preview.value || result.value?.completed) return false
    if (queried.value && result.value && preview.value.expiresIn <= 0) return false
    open.value = true
    error.value = t('admin-content.postBatch.unfinished')
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
      if (owns(version)) error.value = message(cause, 'previewFailed')
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
      error.value = t('admin-content.postBatch.selectionLimit', { limit: POST_SELECTION_LIMIT })
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
      if (owns(version)) error.value = t('admin-content.postBatch.refreshFailed')
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
      if (owns(version)) error.value = message(cause, 'recordFailed')
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
      (preview.value.action === 'delete' && acknowledgement.value !== POST_DELETE_ACKNOWLEDGEMENT)
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
      if (owns(version)) error.value = message(cause, 'executeFailed')
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
      if (owns(version)) error.value = message(cause, 'queryFailed')
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
