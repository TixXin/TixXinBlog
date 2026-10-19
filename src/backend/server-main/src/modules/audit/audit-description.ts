/**
 * @file audit-description.ts
 * @description 固定管理动作与对象映射；不把请求正文、密码、令牌或任意路径写入审计。
 *              动作与字段名走中英字典：写入审计的字段名保持中文，接口读取时按请求语言翻译。
 */
import { isUUID } from 'class-validator'
import type { AuditSummary } from '../../entities/audit-entry.entity'
import { translate, zh, type ApiLocale, type MessageKey } from '../../common/i18n'
/** 审计动作对应的字典 key */
export const auditActionKeys: Readonly<Record<string, MessageKey>> = {
  'auth.login': 'audit.action.authLogin',
  'auth.logout': 'audit.action.authLogout',
  'auth.password': 'audit.action.authPassword',
  'auth.password-reset': 'audit.action.authPasswordReset',
  'auth.refresh-reuse': 'audit.action.authRefreshReuse',
  'session.revoke': 'audit.action.sessionRevoke',
  'session.others': 'audit.action.sessionOthers',
  'post.create': 'audit.action.postCreate',
  'post.update': 'audit.action.postUpdate',
  'post.preview-link': 'audit.action.postPreviewLink',
  'post.archive': 'audit.action.postArchive',
  'post.restore': 'audit.action.postRestore',
  'post.revision': 'audit.action.postRevision',
  'post.batch.preview': 'audit.action.postBatchPreview',
  'post.batch.execute': 'audit.action.postBatchExecute',
  'comment.reply': 'audit.action.commentReply',
  'comment.delete': 'audit.action.commentDelete',
  'comment.moderate': 'audit.action.commentModerate',
  'comment.batch.moderate': 'audit.action.commentBatchModerate',
  'comment.batch.delete': 'audit.action.commentBatchDelete',
  'comment.policy': 'audit.action.commentPolicy',
  'media.upload': 'audit.action.mediaUpload',
  'media.update': 'audit.action.mediaUpdate',
  'media.recycle': 'audit.action.mediaRecycle',
  'media.restore': 'audit.action.mediaRestore',
  'flash.write': 'audit.action.flashWrite',
  'flash.comment.moderate': 'audit.action.flashCommentModerate',
  'flash.comment.delete': 'audit.action.flashCommentDelete',
  'flash.comment.batch.moderate': 'audit.action.flashCommentBatchModerate',
  'flash.comment.batch.delete': 'audit.action.flashCommentBatchDelete',
  'moment.create': 'audit.action.momentCreate',
  'moment.update': 'audit.action.momentUpdate',
  'moment.delete': 'audit.action.momentDelete',
  'moment.comment.reply': 'audit.action.momentCommentReply',
  'moment.comment.moderate': 'audit.action.momentCommentModerate',
  'moment.comment.delete': 'audit.action.momentCommentDelete',
  'guestbook.create': 'audit.action.guestbookCreate',
  'guestbook.update': 'audit.action.guestbookUpdate',
  'guestbook.delete': 'audit.action.guestbookDelete',
  'guestbook.batch.moderate': 'audit.action.guestbookBatchModerate',
  'guestbook.batch.delete': 'audit.action.guestbookBatchDelete',
  'gallery.create': 'audit.action.galleryCreate',
  'gallery.update': 'audit.action.galleryUpdate',
  'gallery.delete': 'audit.action.galleryDelete',
  'project.create': 'audit.action.projectCreate',
  'project.update': 'audit.action.projectUpdate',
  'project.delete': 'audit.action.projectDelete',
  'subscription.create': 'audit.action.subscriptionCreate',
  'subscription.update': 'audit.action.subscriptionUpdate',
  'subscription.delete': 'audit.action.subscriptionDelete',
  'subscription.sort': 'audit.action.subscriptionSort',
  'subscription.favicon': 'audit.action.subscriptionFavicon',
  'image-prompt.create': 'audit.action.imagePromptCreate',
  'image-prompt.update': 'audit.action.imagePromptUpdate',
  'link.create': 'audit.action.linkCreate',
  'link.update': 'audit.action.linkUpdate',
  'link.delete': 'audit.action.linkDelete',
  'link.settings': 'audit.action.linkSettings',
  'taxonomy.write': 'audit.action.taxonomyWrite',
  'site.save': 'audit.action.siteSave',
  'site.restore': 'audit.action.siteRestore',
  'admin.write': 'audit.action.adminWrite',
  'backup.export': 'audit.action.backupExport',
  'backup.preview': 'audit.action.backupPreview',
  'backup.execute': 'audit.action.backupExecute',
  'backup.repreview': 'audit.action.backupRepreview',
  'setup.complete': 'audit.action.setupComplete',
}

/** 动作的中文标签（历史兼容与单测使用） */
export const auditActions: Readonly<Record<string, string>> = auditActionLabels('zh-CN')

/** 按语言返回全部动作标签，供筛选选项使用 */
export function auditActionLabels(locale: ApiLocale): Record<string, string> {
  return Object.fromEntries(Object.entries(auditActionKeys).map(([action, key]) => [action, translate(locale, key)]))
}

/** 单条记录的动作标签；未登记的历史动作显示通用名称 */
export function auditActionLabel(action: string, locale: ApiLocale): string {
  return translate(locale, auditActionKeys[action] ?? 'audit.action.fallback')
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
          parts[3] === 'preview-link'
            ? 'post.preview-link'
            : parts[3] === 'revisions'
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
      if (parts[2] === 'batch') {
        action = parts[3] === 'moderation' ? 'comment.batch.moderate' : 'comment.batch.delete'
      } else {
        action =
          parts[2] === 'policy'
            ? 'comment.policy'
            : parts[3] === 'reply'
              ? 'comment.reply'
              : parts[3] === 'moderation'
                ? 'comment.moderate'
                : 'comment.delete'
      }
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
      if (parts[2] === 'comments' && parts[3] === 'batch') {
        resourceType = 'flash-comment'
        action = parts[4] === 'moderation' ? 'flash.comment.batch.moderate' : 'flash.comment.batch.delete'
      } else if (parts[3] === 'comments') {
        action = method === 'DELETE' ? 'flash.comment.delete' : 'flash.comment.moderate'
      } else action = 'flash.write'
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
    } else if (resourceType === 'subscriptions') {
      resourceType = 'subscription'
      action =
        parts[2] === 'fetch-favicon'
          ? 'subscription.favicon'
          : parts[2] === 'sort'
            ? 'subscription.sort'
            : method === 'POST'
              ? 'subscription.create'
              : method === 'DELETE'
                ? 'subscription.delete'
                : 'subscription.update'
    } else if (resourceType === 'prompts') {
      resourceType = 'image-prompt'
      action = method === 'POST' ? 'image-prompt.create' : 'image-prompt.update'
    } else if (resourceType === 'gallery') {
      action = method === 'POST' ? 'gallery.create' : method === 'DELETE' ? 'gallery.delete' : 'gallery.update'
    } else if (resourceType === 'guestbook') {
      if (parts[2] === 'batch') {
        action = method === 'DELETE' ? 'guestbook.batch.delete' : 'guestbook.batch.moderate'
      } else {
        action = method === 'POST' ? 'guestbook.create' : method === 'DELETE' ? 'guestbook.delete' : 'guestbook.update'
      }
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
/** 摘要字段的字典 key；写入审计时保存中文名称，读取时再按语言翻译 */
const fields: Readonly<Record<string, MessageKey>> = {
  title: 'audit.field.title',
  summary: 'audit.field.summary',
  contentRaw: 'audit.field.contentRaw',
  content: 'audit.field.content',
  category: 'audit.field.category',
  folder: 'audit.field.folder',
  tags: 'audit.field.tags',
  status: 'audit.field.status',
  slug: 'audit.field.slug',
  cover: 'audit.field.cover',
  coverAlt: 'audit.field.coverAlt',
  seoTitle: 'audit.field.seoTitle',
  seoDescription: 'audit.field.seoDescription',
  seoNoindex: 'audit.field.seoNoindex',
  pinned: 'audit.field.pinned',
  readTimeMinutes: 'audit.field.readTimeMinutes',
  name: 'audit.field.name',
  description: 'audit.field.description',
  ownerName: 'audit.field.ownerName',
  ownerTitle: 'audit.field.ownerTitle',
  avatar: 'audit.field.avatar',
  avatarAlt: 'audit.field.avatarAlt',
  announcement: 'audit.field.announcement',
  socials: 'audit.field.socials',
  alt: 'audit.field.alt',
  label: 'audit.field.label',
  color: 'audit.field.color',
  images: 'audit.field.images',
  isDraft: 'audit.field.isDraft',
  isArchived: 'audit.field.isArchived',
  isPinned: 'audit.field.isPinned',
  topics: 'audit.field.topics',
  location: 'audit.field.location',
  device: 'audit.field.device',
  mood: 'audit.field.mood',
  linkedArticleId: 'audit.field.linkedArticleId',
  linkedLink: 'audit.field.linkedLink',
  replyToId: 'audit.field.replyToId',
  requireApproval: 'audit.field.requireApproval',
  mediaId: 'audit.field.mediaId',
  takenOn: 'audit.field.takenOn',
  sortOrder: 'audit.field.sortOrder',
  gear: 'audit.field.gear',
  progress: 'audit.field.progress',
  amount: 'audit.field.amount',
  currency: 'audit.field.currency',
  billingCycle: 'audit.field.billingCycle',
  subscriptionStatus: 'audit.field.subscriptionStatus',
  startDate: 'audit.field.startDate',
  nextBillingDate: 'audit.field.nextBillingDate',
  iconMediaId: 'audit.field.iconMediaId',
  notes: 'audit.field.notes',
  priceChangeReason: 'audit.field.priceChangeReason',
  coverMediaId: 'audit.field.coverMediaId',
  prompt: 'audit.field.prompt',
  negativePrompt: 'audit.field.negativePrompt',
  model: 'audit.field.model',
  imageAlt: 'audit.field.imageAlt',
  externalImageUrl: 'audit.field.externalImageUrl',
  sourceUrl: 'audit.field.sourceUrl',
  links: 'audit.field.links',
  url: 'audit.field.url',
  logoMediaId: 'audit.field.logoMediaId',
  logoUrl: 'audit.field.logoUrl',
  isFeatured: 'audit.field.isFeatured',
  rules: 'audit.field.rules',
}

let fieldKeysByLabel: Map<string, MessageKey> | undefined

/** 把持久化的中文字段名翻译为请求语言；未知名称原样返回 */
export function auditFieldLabel(label: string, locale: ApiLocale): string {
  if (locale === 'zh-CN') return label
  fieldKeysByLabel ??= new Map(Object.values(fields).map((key) => [zh(key), key]))
  const key = fieldKeysByLabel.get(label)
  return key ? translate(locale, key) : label
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
      .map((key) => zh(fields[key]!))
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
    'exportedSubscriptions',
    'exportedLinks',
    'exportedPrompts',
    'exportedMedia',
    'importedPosts',
    'importedFlashes',
    'importedMoments',
    'importedGuestbook',
    'importedGallery',
    'importedProjects',
    'importedSubscriptions',
    'importedLinks',
    'importedPrompts',
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
