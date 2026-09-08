/**
 * @file types.ts
 * @description 审计展示契约与固定标签，不包含任何原始凭据或请求正文。
 */
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
export const auditStateLabels: Record<AuditState, string> = {
  pending: '结果待确认',
  success: '成功',
  partial: '部分成功',
  failure: '失败',
  unknown: '结果未确认',
}
export const auditResourceLabels: Record<string, string> = {
  post: '文章',
  'post-batch': '文章批次',
  comment: '评论',
  media: '媒体',
  flash: '闪念',
  taxonomy: '分类标签',
  site: '站点资料',
  account: '账号',
  session: '会话',
  admin: '管理对象',
  'content-import': '内容迁入',
}
export const auditCountLabels: Record<string, string> = {
  successCount: '成功条目',
  failedCount: '失败条目',
  pendingCount: '未处理条目',
  allowedCount: '可执行条目',
  deleted: '删除数量',
  revoked: '撤销数量',
  byteSize: '资源字节数',
  width: '图片宽度',
  height: '图片高度',
  exportedPosts: '导出文章',
  exportedFlashes: '导出闪念',
  exportedMedia: '包含图片文件',
  importedPosts: '迁入文章草稿',
  importedFlashes: '迁入闪念草稿',
  importedComments: '迁入评论',
  importedMedia: '新增媒体',
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
