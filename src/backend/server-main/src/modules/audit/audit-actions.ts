/**
 * @file audit-actions.ts
 * @description 汇总各领域审计动作与国际化动作标签转换
 */
import { translate, type ApiLocale, type MessageKey } from '../../common/i18n'
import { authAuditActionKeys } from './audit-auth-actions'
import { contentAuditActionKeys } from './audit-content-actions'
import { socialAuditActionKeys } from './audit-social-actions'
import { systemAuditActionKeys } from './audit-system-actions'

/** 审计动作对应的字典 key */
export const auditActionKeys: Readonly<Record<string, MessageKey>> = {
  ...authAuditActionKeys,
  ...contentAuditActionKeys,
  ...socialAuditActionKeys,
  ...systemAuditActionKeys,
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
