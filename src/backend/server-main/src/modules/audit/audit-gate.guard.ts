/**
 * @file audit-gate.guard.ts
 * @description 限流后记录写入意图；审计存储不可用时不开始管理写入。
 */
import { Injectable } from '@nestjs/common'
import type { CanActivate, ExecutionContext } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { Response } from 'express'
import { isUUID } from 'class-validator'
import { AuditService } from './audit.service'
import { auditDescriptor } from './audit-description'
import { requestAuditActor } from './audit-request'
import type { AuditRequest } from './audit-request'
@Injectable()
export class AuditGateGuard implements CanActivate {
  constructor(
    private readonly audit: AuditService,
    private readonly jwt: JwtService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuditRequest>()
    const response = context.switchToHttp().getResponse<Response>()
    const descriptor = auditDescriptor(request.path, request.method)
    if (!descriptor) return true
    if (request.headers.authorization?.startsWith('Bearer ')) {
      try {
        const payload = await this.jwt.verifyAsync<{ sub?: string; username?: string; sid?: string }>(
          request.headers.authorization.slice(7),
        )
        if (typeof payload.sub === 'string' && isUUID(payload.sub))
          request.auditActor = {
            id: payload.sub,
            name: typeof payload.username === 'string' ? payload.username.slice(0, 80) : undefined,
            sessionId: typeof payload.sid === 'string' && isUUID(payload.sid) ? payload.sid : undefined,
          }
      } catch {
        /* 非法令牌交给认证守卫拒绝，不让匿名管理探测产生数据库写放大。 */
      }
    }
    if (!request.auditActor && !['auth.login', 'auth.logout'].includes(descriptor.action)) return true
    if (descriptor.resourceType === 'account' && request.auditActor) descriptor.resourceId = request.auditActor.id
    const ticket = (request.body as { ticket?: unknown } | undefined)?.ticket
    if (descriptor.resourceType === 'post-batch' && typeof ticket === 'string' && isUUID(ticket))
      descriptor.resourceId = ticket.toLowerCase()
    const trace = String(request.id ?? '')
    request.auditId = await this.audit.begin(descriptor, request.auditActor, isUUID(trace) ? trace : undefined)
    request.auditResourceId = descriptor.resourceId
    response.setHeader('X-Audit-Id', request.auditId)
    response.once('finish', () => {
      if (request.auditFinished || request.auditHandlerStarted) return
      request.auditFinished = true
      void this.audit.complete(request.auditId!, {
        actor: requestAuditActor(request),
        resourceId: request.auditResourceId,
        state: response.statusCode < 400 ? 'unknown' : 'failure',
        statusCode: response.statusCode,
        summary: { fields: [] },
      })
    })
    response.once('close', () => {
      if (request.auditFinished || request.auditHandlerStarted) return
      request.auditFinished = true
      void this.audit.complete(request.auditId!, {
        actor: requestAuditActor(request),
        resourceId: request.auditResourceId,
        state: 'unknown',
        summary: { fields: [] },
      })
    })
    return true
  }
}
