/**
 * @file useAdminComments.ts
 * @description 文章评论管理流程：筛选读取、上下文获取、博主回复、单条审核删除与批量处理
 * @author TixXin
 * @since 2026-10-21
 */
import type { AdminBatchResult } from '~/composables/useAdminBatchSelection'
import { apiErrorMessage } from '~/utils/apiError'
import {
  buildCommentListQuery,
  buildCommentPageQuery,
  defaultCommentFilters,
  formatCommentBatchMessage,
  getCommentBatchActions,
  getCommentStatusLabels,
  getModerateConfirmText,
  parseCommentQueryParams,
} from './commentModeration'
import type { AdminCommentContextData, AdminCommentRow, CommentStatus } from './types'

export type { AdminCommentContextData, AdminCommentRow, CommentStatus, CommentText } from './types'
export { COMMENT_STATUSES } from './commentModeration'

export function useAdminComments() {
  const { t } = useI18n(),
    api = useAdminApi(),
    { success } = useToast(),
    route = useRoute(),
    router = useRouter()

  const statusLabels = computed(() => getCommentStatusLabels(t))
  const filters = reactive(defaultCommentFilters()),
    items = ref<AdminCommentRow[]>([]),
    articles = ref<{ id: number; title: string }[]>([]),
    articleError = ref(false),
    total = ref(0),
    page = ref(1),
    pending = ref(false),
    working = ref(false),
    replySubmitting = ref(false),
    error = ref(''),
    replyTarget = ref<AdminCommentRow | null>(null),
    replyText = ref(''),
    context = ref<AdminCommentContextData | null>(null),
    contextPending = ref(false),
    contextError = ref(''),
    batchBusy = ref('')

  let listVersion = 0,
    contextVersion = 0

  const selection = useAdminBatchSelection(items)
  const batchActions = computed(() => getCommentBatchActions(t))
  const replyDirty = computed(() => !!replyTarget.value && !!replyText.value.trim())
  const allowDiscard = () => !replyDirty.value || window.confirm(t('admin-content.comments.reply.discardConfirm'))
  const clearPostCache = () => clearNuxtData((k) => k.startsWith('article-') || k.startsWith('post-'))

  function cancelReply() {
    if (allowDiscard()) {
      replyTarget.value = null
      replyText.value = ''
    }
  }

  function startReply(comment: AdminCommentRow) {
    if (working.value || comment.id === replyTarget.value?.id || !allowDiscard()) return false
    replyTarget.value = comment
    replyText.value = ''
    return true
  }

  function syncQuery() {
    const parsed = parseCommentQueryParams(route.query)
    Object.assign(filters, parsed.filters)
    page.value = parsed.page
  }

  async function changePage(val: number) {
    const q = buildCommentPageQuery(val, filters)
    if (router.resolve({ path: '/admin/comments', query: q }).fullPath === route.fullPath) await load()
    else await router.push({ path: '/admin/comments', query: q })
  }

  async function loadArticles() {
    articleError.value = false
    try {
      articles.value = await api('/admin/comments/articles')
    } catch {
      articleError.value = true
    }
  }

  async function load() {
    const version = ++listVersion
    pending.value = true
    error.value = ''
    try {
      const res = await api<{ items: AdminCommentRow[]; total: number }>('/admin/comments', {
        query: buildCommentListQuery(page.value, filters),
      })
      if (version !== listVersion) return
      items.value = res.items
      total.value = res.total
      const lastPage = Math.max(1, Math.ceil(total.value / 20))
      if (page.value > lastPage) await changePage(lastPage)
    } catch {
      if (version === listVersion) {
        items.value = []
        error.value = t('admin-content.comments.listFailed')
      }
    } finally {
      if (version === listVersion) pending.value = false
    }
  }

  async function showContext(id: number, currentPage = 1) {
    const version = ++contextVersion
    contextPending.value = true
    contextError.value = ''
    context.value = null
    try {
      const res = await api<AdminCommentContextData>(`/admin/comments/${id}/context`, { query: { page: currentPage } })
      if (version === contextVersion) context.value = res
      return res
    } catch {
      if (version === contextVersion) contextError.value = t('admin-content.comments.context.loadFailed')
      return null
    } finally {
      if (version === contextVersion) contextPending.value = false
    }
  }

  function closeContext() {
    contextVersion += 1
    context.value = null
    contextError.value = ''
    contextPending.value = false
  }

  async function remove(comment: AdminCommentRow) {
    if (working.value || pending.value) return
    if (replyDirty.value) return void (error.value = t('admin-content.comments.remove.replyDirty'))
    working.value = true
    error.value = ''
    try {
      const preview = await api<AdminCommentContextData>(`/admin/comments/${comment.id}/context`)
      const confirmMsg = t('admin-content.comments.remove.confirm', {
        author: comment.author,
        count: preview.deleteTotal,
      })
      if (!window.confirm(confirmMsg)) return
      const res = await api<{ deleted: number }>(`/admin/comments/${comment.id}`, {
        method: 'DELETE',
        query: { expectedTotal: preview.deleteTotal, expectedFingerprint: preview.deleteFingerprint },
      })
      closeContext()
      replyTarget.value = null
      clearPostCache()
      success(t('admin-content.comments.remove.done', { count: res.deleted }))
      await Promise.all([loadArticles(), load()])
    } catch (cause) {
      error.value = apiErrorMessage(cause, 'admin-content.comments.remove.failed')
    } finally {
      working.value = false
    }
  }

  async function runBatch(action: string) {
    if (working.value || pending.value) return
    const selected = selection.selectedItems.value
    if (!selected.length) return
    if (replyDirty.value) return void (error.value = t('admin-content.comments.batch.replyDirty'))
    const isDelete = action === 'delete'
    if (isDelete && !window.confirm(t('admin-content.comments.batch.deleteConfirm', { count: selected.length }))) return
    working.value = true
    batchBusy.value = action
    error.value = ''
    const payload = selected.map((c) => ({ id: c.id, revision: c.revision }))
    try {
      const endpoint = isDelete ? '/admin/comments/batch/delete' : '/admin/comments/batch/moderation'
      const body = isDelete ? { items: payload } : { status: action, items: payload }
      const res = await api<AdminBatchResult & { deleted?: number }>(endpoint, { method: 'POST', body })
      const message = formatCommentBatchMessage(res, action, statusLabels.value, t)
      selection.clear()
      if (isDelete) closeContext()
      clearPostCache()
      await Promise.all([isDelete ? loadArticles() : Promise.resolve(), load()])
      if (!isDelete && context.value) await showContext(context.value.target.id, context.value.page)
      if (res.failedCount) error.value = message
      else {
        const ok = isDelete
          ? t('admin-content.comments.batch.deletedWithReplies', { message, count: res.deleted ?? 0 })
          : message
        success(ok)
      }
    } catch (cause) {
      error.value = apiErrorMessage(cause, 'admin-content.comments.batch.failed')
    } finally {
      working.value = false
      batchBusy.value = ''
    }
  }

  async function sendReply() {
    if (!replyTarget.value || working.value) return
    working.value = true
    replySubmitting.value = true
    error.value = ''
    try {
      await api(`/admin/comments/${replyTarget.value.id}/reply`, { method: 'POST', body: { content: replyText.value } })
      replyTarget.value = null
      replyText.value = ''
      clearPostCache()
      success(t('admin-content.comments.reply.sent'))
      await load()
      if (context.value) await showContext(context.value.target.id, context.value.page)
    } catch (cause) {
      error.value = apiErrorMessage(cause, 'admin-content.comments.reply.failed')
    } finally {
      working.value = false
      replySubmitting.value = false
    }
  }

  async function moderate(comment: AdminCommentRow, target: CommentStatus) {
    if (working.value || pending.value) return
    if (replyDirty.value) return void (error.value = t('admin-content.comments.moderate.replyDirty'))
    working.value = true
    error.value = ''
    try {
      const preview = await api<AdminCommentContextData>(`/admin/comments/${comment.id}/context`)
      const confirmMsg = getModerateConfirmText(t, comment.author, statusLabels.value[target], preview, target)
      if (!window.confirm(confirmMsg)) return
      await api(`/admin/comments/${comment.id}/moderation`, {
        method: 'POST',
        body: { status: target, revision: preview.target.revision, expectedFingerprint: preview.deleteFingerprint },
      })
      success(t('admin-content.comments.moderate.done'))
      clearPostCache()
      await load()
      if (context.value) await showContext(context.value.target.id, context.value.page)
    } catch (cause) {
      error.value = apiErrorMessage(cause, 'admin-content.comments.moderate.failed')
    } finally {
      working.value = false
    }
  }

  return {
    statusLabels,
    items,
    articles,
    articleError,
    total,
    page,
    ...toRefs(filters),
    pending,
    working,
    replySubmitting,
    error,
    replyTarget,
    replyText,
    replyDirty,
    context,
    contextPending,
    contextError,
    selection,
    batchBusy,
    batchActions,
    allowDiscard,
    cancelReply,
    startReply,
    syncQuery,
    changePage,
    resetPage: () => void changePage(1),
    previousPage: () => void changePage(Math.max(1, page.value - 1)),
    nextPage: () => void changePage(page.value + 1),
    loadArticles,
    load,
    showContext,
    closeContext,
    remove,
    runBatch,
    sendReply,
    moderate,
    cleanup: () => {
      listVersion += 1
      contextVersion += 1
    },
  }
}
