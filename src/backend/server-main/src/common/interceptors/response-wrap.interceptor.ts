/**
 * @file response-wrap.interceptor.ts
 * @description 全局响应拦截器：成功响应统一包装为 { code: 0, message: 'ok', data, traceId }
 * @author TixXin
 * @since 2026-07-20
 */

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import type { Request } from 'express'
import { map, Observable } from 'rxjs'
import { ErrorCode } from '../constants/error-codes'
import { getTraceId } from '../utils/trace-id'

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
  traceId: string
}

@Injectable()
export class ResponseWrapInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>()
    const traceId = getTraceId(request)

    return next.handle().pipe(
      map((data) => ({
        code: ErrorCode.Ok,
        message: 'ok',
        data: data ?? (null as T),
        traceId,
      })),
    )
  }
}
