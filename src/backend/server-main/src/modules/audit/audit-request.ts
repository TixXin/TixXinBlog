/**
 * @file audit-request.ts
 * @description 单次请求中的最小审计上下文，不持有凭据副本。
 */
import type { AuthedRequest } from '../../common/guards/admin-auth.guard'
import type { AuditActor } from './audit.service'
export interface AuditRequest extends AuthedRequest {
  auditId?: string
  auditActor?: AuditActor
  auditResourceId?: string
  auditFinished?: boolean
  auditHandlerStarted?: boolean
}
export function requestAuditActor(request: AuditRequest): AuditActor | undefined {
  const admin = request.adminUser
  return admin ? { id: admin.id, name: admin.username, sessionId: admin.sessionId } : request.auditActor
}
