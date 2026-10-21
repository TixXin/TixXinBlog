/**
 * @file audit-content-actions.ts
 * @description 内容创作领域审计动作字典映射（文章、闪念、动态、图库、项目、提示词）
 */
import type { MessageKey } from '../../common/i18n'

export const contentAuditActionKeys: Readonly<Record<string, MessageKey>> = {
  'post.create': 'audit.action.postCreate',
  'post.update': 'audit.action.postUpdate',
  'post.preview-link': 'audit.action.postPreviewLink',
  'post.archive': 'audit.action.postArchive',
  'post.restore': 'audit.action.postRestore',
  'post.revision': 'audit.action.postRevision',
  'post.batch.preview': 'audit.action.postBatchPreview',
  'post.batch.execute': 'audit.action.postBatchExecute',
  'flash.write': 'audit.action.flashWrite',
  'moment.create': 'audit.action.momentCreate',
  'moment.update': 'audit.action.momentUpdate',
  'moment.delete': 'audit.action.momentDelete',
  'gallery.create': 'audit.action.galleryCreate',
  'gallery.update': 'audit.action.galleryUpdate',
  'gallery.delete': 'audit.action.galleryDelete',
  'project.create': 'audit.action.projectCreate',
  'project.update': 'audit.action.projectUpdate',
  'project.delete': 'audit.action.projectDelete',
  'image-prompt.create': 'audit.action.imagePromptCreate',
  'image-prompt.update': 'audit.action.imagePromptUpdate',
}
