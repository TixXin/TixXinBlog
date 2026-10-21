/**
 * @file audit-descriptor.ts
 * @description 管理请求路由解析为审计动作、资源类型及标识符
 */
import { isUUID } from 'class-validator'

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
