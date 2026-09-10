/**
 * @file audit-description.ts
 * @description 固定管理动作与对象映射；不把请求正文、密码、令牌或任意路径写入审计。
 */
import { isUUID } from 'class-validator'
import type { AuditSummary } from '../../entities/audit-entry.entity'
export const auditActions: Record<string, string> = {
  'auth.login': '登录',
  'auth.logout': '退出会话',
  'auth.password': '修改密码',
  'session.revoke': '撤销会话',
  'session.others': '撤销其他会话',
  'post.create': '新建文章',
  'post.update': '保存文章',
  'post.archive': '归档文章',
  'post.restore': '恢复文章',
  'post.revision': '恢复文章修订',
  'post.batch.preview': '预览文章批量操作',
  'post.batch.execute': '执行文章批量操作',
  'comment.reply': '博主回复',
  'comment.delete': '删除评论及回复',
  'comment.moderate': '审核评论',
  'comment.policy': '修改审核策略',
  'media.upload': '上传图片',
  'media.update': '修改图片说明',
  'media.recycle': '回收图片',
  'media.restore': '恢复图片',
  'flash.write': '管理闪念',
  'moment.create': '发布动态',
  'moment.update': '更新动态',
  'moment.delete': '删除动态',
  'moment.comment.reply': '回复动态评论',
  'moment.comment.moderate': '审核动态评论',
  'moment.comment.delete': '删除动态评论',
  'guestbook.create': '发布或回复留言',
  'guestbook.update': '审核或置顶留言',
  'guestbook.delete': '删除留言',
  'gallery.create': '创建图库作品',
  'gallery.update': '编辑发布或排序图库作品',
  'gallery.delete': '删除图库作品',
  'project.create': '创建项目',
  'project.update': '编辑发布或排序项目',
  'project.delete': '删除项目',
  'link.create': '创建友链',
  'link.update': '编辑推荐上下架或排序友链',
  'link.delete': '删除友链',
  'link.settings': '修改友链规则',
  'taxonomy.write': '管理分类标签',
  'site.save': '保存站点资料',
  'site.restore': '恢复站点资料',
  'admin.write': '管理写入',
  'backup.export': '导出内容包',
  'backup.preview': '预览内容导入',
  'backup.execute': '执行内容导入',
  'backup.repreview': '更新导入预览',
}
export function auditDescriptor(path: string, method: string) {
  if (!['POST', 'PATCH', 'DELETE'].includes(method)) return null
  const route = path.replace(/^\/api\/v1/, '')
  const parts = route.split('/').filter(Boolean)
  const identifier = (value?: string) =>
    value && (/^\d{1,12}$/.test(value) || isUUID(value)) ? value.toLowerCase() : undefined
  let action: string
  let resourceType: string
  let resourceId: string | undefined
  if (parts[0] === 'auth') {
    if (['login', 'logout', 'password'].includes(parts[1] ?? '')) {
      action = `auth.${parts[1]}`
      resourceType = parts[1] === 'logout' ? 'session' : 'account'
    } else if (parts[1] === 'sessions') {
      action = parts[2] === 'revoke-others' ? 'session.others' : 'session.revoke'
      resourceType = 'session'
      resourceId = identifier(parts[2])
    } else return null
  } else if (parts[0] === 'admin') {
    resourceType = parts[1] ?? 'admin'
    resourceId = identifier(parts[2])
    if (resourceType === 'posts') {
      if (parts[2] === 'batch') {
        resourceType = 'post-batch'
        action = parts[3] === 'preview' ? 'post.batch.preview' : 'post.batch.execute'
      } else {
        resourceType = 'post'
        action =
          parts[3] === 'revisions'
            ? 'post.revision'
            : parts[3] === 'restore'
              ? 'post.restore'
              : method === 'DELETE'
                ? 'post.archive'
                : method === 'POST'
                  ? 'post.create'
                  : 'post.update'
      }
    } else if (resourceType === 'comments') {
      resourceType = 'comment'
      action =
        parts[2] === 'policy'
          ? 'comment.policy'
          : parts[3] === 'reply'
            ? 'comment.reply'
            : parts[3] === 'moderation'
              ? 'comment.moderate'
              : 'comment.delete'
    } else if (resourceType === 'media')
      action =
        parts[3] === 'restore'
          ? 'media.restore'
          : method === 'DELETE'
            ? 'media.recycle'
            : method === 'POST'
              ? 'media.upload'
              : 'media.update'
    else if (resourceType === 'flashes') {
      resourceType = 'flash'
      action = 'flash.write'
    } else if (resourceType === 'moments') {
      resourceType = 'moment'
      action =
        parts[3] === 'comments'
          ? method === 'DELETE'
            ? 'moment.comment.delete'
            : method === 'PATCH'
              ? 'moment.comment.moderate'
              : 'moment.comment.reply'
          : method === 'DELETE'
            ? 'moment.delete'
            : method === 'POST'
              ? 'moment.create'
              : 'moment.update'
    } else if (resourceType === 'links') {
      resourceType = 'link'
      action =
        parts[2] === 'settings'
          ? 'link.settings'
          : method === 'POST'
            ? 'link.create'
            : method === 'DELETE'
              ? 'link.delete'
              : 'link.update'
    } else if (resourceType === 'projects') {
      resourceType = 'project'
      action = method === 'POST' ? 'project.create' : method === 'DELETE' ? 'project.delete' : 'project.update'
    } else if (resourceType === 'gallery') {
      action = method === 'POST' ? 'gallery.create' : method === 'DELETE' ? 'gallery.delete' : 'gallery.update'
    } else if (resourceType === 'guestbook') {
      action = method === 'POST' ? 'guestbook.create' : method === 'DELETE' ? 'guestbook.delete' : 'guestbook.update'
    } else if (resourceType === 'taxonomy') {
      action = 'taxonomy.write'
      resourceId = identifier(parts[3])
    } else if (resourceType === 'site') action = parts[2] === 'revisions' ? 'site.restore' : 'site.save'
    else if (resourceType === 'backup') {
      resourceType = 'content-import'
      resourceId = identifier(parts[3])
      action =
        parts[2] === 'export'
          ? 'backup.export'
          : parts[3] === 'preview'
            ? 'backup.preview'
            : parts[4] === 'execute'
              ? 'backup.execute'
              : 'backup.repreview'
    } else action = 'admin.write'
  } else return null
  return { action, resourceType, resourceId }
}
const fields: Record<string, string> = {
  title: '标题',
  summary: '摘要',
  contentRaw: '正文',
  content: '内容',
  category: '类型',
  folder: '专栏',
  tags: '标签',
  status: '状态',
  slug: '地址标识',
  cover: '封面',
  coverAlt: '封面说明',
  seoTitle: 'SEO 标题',
  seoDescription: 'SEO 描述',
  seoNoindex: '收录选项',
  pinned: '置顶',
  readTimeMinutes: '阅读时间',
  name: '站点名称',
  description: '站点简介',
  ownerName: '博主名称',
  ownerTitle: '博主简介',
  avatar: '头像',
  avatarAlt: '头像说明',
  announcement: '公告',
  socials: '社交链接',
  alt: '图片说明',
  label: '名称',
  color: '颜色',
  images: '图片',
  isDraft: '草稿状态',
  isArchived: '归档状态',
  isPinned: '置顶状态',
  topics: '话题',
  location: '地点',
  device: '设备',
  mood: '心情',
  linkedArticleId: '引用文章',
  linkedLink: '引用链接',
  replyToId: '回复留言',
  requireApproval: '评论审核策略',
  mediaId: '作品图片',
  takenOn: '拍摄日期',
  sortOrder: '显示排序',
  gear: '器材介绍',
  progress: '项目进展',
  coverMediaId: '项目封面',
  links: '关联链接',
  url: '站点地址',
  logoMediaId: '友链媒体头像',
  logoUrl: '友链外部头像',
  isFeatured: '推荐状态',
  rules: '友链规则',
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}
export function auditResult(
  body: unknown,
  response: unknown,
): { summary: AuditSummary; resourceId?: string; partial: boolean; failed: boolean } {
  const input = object(body)
  const envelope = object(response)
  const value = 'code' in envelope && 'data' in envelope ? object(envelope.data) : envelope
  const summary: AuditSummary = {
    fields: Object.keys(input)
      .filter((key) => Object.hasOwn(fields, key))
      .map((key) => fields[key]!)
      .slice(0, 24),
  }
  if (Number.isSafeInteger(input.revision) && Number(input.revision) >= 0)
    summary.submittedVersion = Number(input.revision)
  if (Number.isSafeInteger(value.revision) && Number(value.revision) >= 0)
    summary.currentVersion = Number(value.revision)
  const counts: Record<string, number> = {}
  for (const key of [
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
    'exportedMoments',
    'exportedGuestbook',
    'exportedGallery',
    'exportedProjects',
    'exportedLinks',
    'exportedMedia',
    'importedPosts',
    'importedFlashes',
    'importedMoments',
    'importedGuestbook',
    'importedGallery',
    'importedProjects',
    'importedLinks',
    'importedComments',
    'importedMedia',
  ])
    if (Number.isSafeInteger(value[key]) && Number(value[key]) >= 0) counts[key] = Number(value[key])
  if (Object.keys(counts).length) summary.counts = counts
  if (
    typeof value.status === 'string' &&
    ['draft', 'published', 'archived', 'pending', 'hidden', 'spam', 'withdrawn'].includes(value.status)
  )
    summary.targetState = value.status
  if (typeof value.requireApproval === 'boolean')
    summary.targetState = value.requireApproval ? 'review-required' : 'direct-publication'
  const id = value.ticket ?? value.id
  const resourceId =
    typeof id === 'number' && Number.isSafeInteger(id)
      ? String(id)
      : typeof id === 'string' && isUUID(id)
        ? id.toLowerCase()
        : undefined
  return {
    summary,
    resourceId,
    partial: Number(value.failedCount) > 0 && Number(value.successCount) > 0,
    failed: Number(value.failedCount) > 0 && Number(value.successCount) === 0,
  }
}
