/**
 * @file commentModeration.ts
 * @description 文章评论审核纯函数：路由参数解析、列表查询构建与批量结果文案组织
 * @author TixXin
 * @since 2026-10-21
 */
import { describeBatchResult } from '~/composables/useAdminBatchSelection'
import type { AdminBatchAction, AdminBatchResult } from '~/composables/useAdminBatchSelection'
import type { AdminCommentContextData, CommentStatus } from './types'

export const COMMENT_STATUSES: CommentStatus[] = ['published', 'pending', 'hidden', 'spam']

export interface CommentFilters {
  postId: string
  search: string
  unanswered: boolean
  status: string
  from: string
  to: string
}

export function defaultCommentFilters(): CommentFilters {
  return { postId: '', search: '', unanswered: false, status: '', from: '', to: '' }
}

export function getCommentStatusLabels(t: (key: string) => string): Record<CommentStatus, string> {
  return Object.fromEntries(COMMENT_STATUSES.map((val) => [val, t(`admin-content.comments.status.${val}`)])) as Record<
    CommentStatus,
    string
  >
}

export function getCommentBatchActions(t: (key: string) => string): AdminBatchAction[] {
  return [
    { key: 'published', label: t('admin-content.comments.batch.approve'), icon: 'lucide:check' },
    { key: 'hidden', label: t('admin-content.comments.batch.hide'), icon: 'lucide:eye-off' },
    { key: 'spam', label: t('admin-content.comments.batch.spam'), icon: 'lucide:shield-alert' },
    { key: 'delete', label: t('admin-content.comments.batch.delete'), icon: 'lucide:trash-2', danger: true },
  ]
}

export function parseCommentQueryParams(query: Record<string, unknown>) {
  const text = (key: string) => (typeof query[key] === 'string' ? (query[key] as string) : '')
  const pageNum = Number(text('page'))
  const filters: CommentFilters = {
    search: text('search'),
    postId: /^[1-9]\d*$/.test(text('postId')) ? text('postId') : '',
    unanswered: text('unanswered') === 'true',
    status: (COMMENT_STATUSES as readonly string[]).includes(text('status')) ? (text('status') as CommentStatus) : '',
    from: text('from'),
    to: text('to'),
  }
  return { filters, page: Number.isSafeInteger(pageNum) && pageNum > 0 ? pageNum : 1 }
}

export function buildCommentPageQuery(page: number, filters: CommentFilters): Record<string, string> {
  const result: Record<string, string> = {}
  if (filters.postId) result.postId = filters.postId
  if (filters.search.trim()) result.search = filters.search.trim()
  if (filters.unanswered) result.unanswered = 'true'
  if (filters.status) result.status = filters.status
  if (filters.from) result.from = filters.from
  if (filters.to) result.to = filters.to
  if (page > 1) result.page = String(page)
  return result
}

export function buildCommentListQuery(page: number, filters: CommentFilters) {
  return {
    page,
    pageSize: 20,
    postId: filters.postId || undefined,
    search: filters.search.trim() || undefined,
    unanswered: filters.unanswered ? 'true' : undefined,
    status: filters.status || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
  }
}

export function formatCommentBatchMessage(
  result: AdminBatchResult,
  action: string,
  statusLabels: Record<CommentStatus, string>,
  t: (key: string, ...args: unknown[]) => string,
) {
  const isDelete = action === 'delete'
  const fallback = isDelete
    ? t('admin-content.comments.batch.deleted')
    : t('admin-content.comments.batch.setTo', { status: statusLabels[action as CommentStatus] })
  return describeBatchResult(result, fallback, (count: number) => t('admin-content.comments.batch.noun', count), t)
}

export function getModerateConfirmText(
  t: (key: string, ...args: unknown[]) => string,
  author: string,
  statusLabel: string,
  preview: AdminCommentContextData,
  target: CommentStatus,
) {
  return t('admin-content.comments.moderate.confirm', {
    author,
    status: statusLabel,
    count: preview.deleteTotal,
    visible: preview.visibleTotal,
    after: target === 'published' ? preview.approvedVisibleTotal : 0,
  })
}
