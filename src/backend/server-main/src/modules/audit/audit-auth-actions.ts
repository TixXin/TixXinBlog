/**
 * @file audit-auth-actions.ts
 * @description 认证与会话领域审计动作字典映射
 */
import type { MessageKey } from '../../common/i18n'

export const authAuditActionKeys: Readonly<Record<string, MessageKey>> = {
  'auth.login': 'audit.action.authLogin',
  'auth.logout': 'audit.action.authLogout',
  'auth.password': 'audit.action.authPassword',
  'auth.password-reset': 'audit.action.authPasswordReset',
  'auth.refresh-reuse': 'audit.action.authRefreshReuse',
  'session.revoke': 'audit.action.sessionRevoke',
  'session.others': 'audit.action.sessionOthers',
}
