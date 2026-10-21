/**
 * @file audit-system-actions.ts
 * @description 系统、分类、媒体与运维领域审计动作字典映射
 */
import type { MessageKey } from '../../common/i18n'

export const systemAuditActionKeys: Readonly<Record<string, MessageKey>> = {
  'media.upload': 'audit.action.mediaUpload',
  'media.update': 'audit.action.mediaUpdate',
  'media.recycle': 'audit.action.mediaRecycle',
  'media.restore': 'audit.action.mediaRestore',
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
