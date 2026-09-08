/**
 * @file audit.interceptor.ts
 * @description 只提取白名单摘要；成功与失败都补全记录，不把令牌或原始内容传给审计存储。
 */
import { HttpException, Injectable } from '@nestjs/common'
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common'
import { catchError, finalize, from, mergeMap } from 'rxjs'
import type { Response } from 'express'
import { AuditService } from './audit.service'
import { auditResult } from './audit-description'
import { requestAuditActor } from './audit-request'
import type { AuditRequest } from './audit-request'
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<AuditRequest>()
    if (!request.auditId) return next.handle()
    const response = context.switchToHttp().getResponse<Response>()
    request.auditHandlerStarted = true
    return next.handle().pipe(
      mergeMap(async (value: unknown) => {
        const result = auditResult(request.body, value)
        request.auditFinished = true
        const persisted = await this.audit.complete(request.auditId!, {
          actor: requestAuditActor(request),
          resourceId: request.auditResourceId ?? result.resourceId,
          state: result.partial ? 'partial' : result.failed ? 'failure' : 'success',
          statusCode: response.statusCode,
          summary: result.summary,
        })
        if (!persisted && !response.headersSent) response.setHeader('X-Audit-Status', 'pending')
        return value
      }),
      catchError((error: unknown) =>
        from(
          (async () => {
            request.auditFinished = true
            await this.audit.complete(request.auditId!, {
              actor: requestAuditActor(request),
              resourceId: request.auditResourceId,
              state: 'failure',
              statusCode: error instanceof HttpException ? error.getStatus() : 500,
              summary: auditResult(request.body, null).summary,
            })
            throw error
          })(),
        ),
      ),
      finalize(() => {
        if (request.auditFinished) return
        request.auditFinished = true
        void this.audit.complete(request.auditId!, {
          actor: requestAuditActor(request),
          resourceId: request.auditResourceId,
          state: 'unknown',
          summary: { fields: [] },
        })
      }),
    )
  }
}
