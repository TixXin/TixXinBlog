/**
 * @file types.ts
 * @description 审计展示契约与固定标签（名称由调用方按 admin-system 字典翻译），不包含任何原始凭据或请求正文。
 */
import type { Translate } from '~/utils/format'
export type AuditState = 'pending' | 'success' | 'partial' | 'failure' | 'unknown'
export interface AuditItem {
  id: string
  actor: string
  actorId?: string
  action: string
  actionLabel: string
  resourceType: string
  resourceId?: string
  state: AuditState
  statusCode?: number
  summary: {
    fields: string[]
    submittedVersion?: number
    currentVersion?: number
    counts?: Record<string, number>
    targetState?: string
  }
  createdAt: string
  finishedAt?: string
  traceId?: string
}
/** 审计结果状态，名称见 admin-system.audit.states.* */
export const auditStates: readonly AuditState[] = ['pending', 'success', 'partial', 'failure', 'unknown']
/** 有字典名称的审计对象类型，名称见 admin-system.audit.resources.* */
const auditResourceTypes = new Set([
  'post',
  'post-batch',
  'comment',
  'media',
  'flash',
  'taxonomy',
  'site',
  'account',
  'session',
  'admin',
  'content-import',
])
/** 有字典名称的审计计数项，名称见 admin-system.audit.counts.* */
const auditCountKeys = new Set([
  'successCount',
  'failedCount',
  'pendingCount',
  'allowedCount',
  'deleted',
  'revoked',
  'byteSize',
  'width',
  'height',
  'exportedPosts',
  'exportedFlashes',
  'exportedMedia',
  'importedPosts',
  'importedFlashes',
  'importedComments',
  'importedMedia',
])
export function isAuditState(value: string): value is AuditState {
  return (auditStates as readonly string[]).includes(value)
}
/** 审计对象名称；未知类型统一显示为「管理对象」 */
export function auditResourceLabel(type: string, t: Translate) {
  return t(`admin-system.audit.resources.${auditResourceTypes.has(type) ? type : 'admin'}`)
}
/** 审计计数项名称；未知计数项原样显示 key */
export function auditCountLabel(key: string, t: Translate) {
  return auditCountKeys.has(key) ? t(`admin-system.audit.counts.${key}`) : key
}
export function auditResourceLink(item: AuditItem): string | undefined {
  if (item.resourceType === 'content-import')
    return item.action !== 'backup.export' && item.resourceId
      ? `/admin/maintenance?import=${encodeURIComponent(item.resourceId)}`
      : '/admin/maintenance'
  if (item.resourceType === 'post' && /^\d+$/.test(item.resourceId ?? '')) return `/admin/posts/${item.resourceId}`
  if (item.resourceType === 'comment' && /^\d+$/.test(item.resourceId ?? ''))
    return `/admin/comments?commentId=${item.resourceId}`
  if (item.resourceType === 'post-batch' && /^[a-f0-9-]{36}$/.test(item.resourceId ?? ''))
    return `/admin/posts?operation=${item.resourceId}`
  if (item.resourceType === 'media' && /^[a-f0-9-]{36}$/.test(item.resourceId ?? ''))
    return `/admin/media?search=${item.resourceId}&deleted=${item.action === 'media.recycle' ? 'true' : 'false'}`
  return (
    {
      flash: '/admin/flashes',
      taxonomy: '/admin/taxonomy',
      site: '/admin/site',
      account: '/admin/account',
      session: '/admin/account',
    } as Record<string, string>
  )[item.resourceType]
}
