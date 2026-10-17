/**
 * @file all-exceptions.filter.ts
 * @description 全局异常过滤器：所有错误统一包装为 { code, message, data: null, traceId }，服务端异常记录堆栈
 * @author TixXin
 * @since 2026-07-20
 */

import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common'
import type { Request, Response } from 'express'
import { ErrorCode, HTTP_STATUS_TO_ERROR_CODE } from '../constants/error-codes'
import { BusinessException } from '../exceptions/business.exception'
import { getTraceId } from '../utils/trace-id'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('AllExceptionsFilter')

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()
    const traceId = getTraceId(request)

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR
    let code: number = ErrorCode.ServerError
    let message = '服务端异常'

    if (exception instanceof BusinessException) {
      status = exception.getStatus()
      code = exception.code
      message = exception.message
    } else if (exception instanceof HttpException) {
      status = exception.getStatus()
      code = HTTP_STATUS_TO_ERROR_CODE[status] ?? ErrorCode.ServerError
      // ValidationPipe 的 400 响应把明细放在 response.message 数组里，取首条最有信息量
      const body = exception.getResponse()
      if (typeof body === 'string') {
        message = body
      } else if (typeof body === 'object' && body !== null && 'message' in body) {
        const raw = (body as { message: string | string[] }).message
        message = Array.isArray(raw) ? (raw[0] ?? exception.message) : raw
      } else {
        message = exception.message
      }
    }

    // 未知异常与所有 5xx 在服务端记录堆栈和 traceId；客户端只收到通用文案与 traceId。
    if (!(exception instanceof HttpException) || status >= 500) {
      this.logger.error(
        { err: exception instanceof Error ? exception : new Error(String(exception)), traceId, status },
        `请求处理异常 ${request.method} ${request.path ?? request.url}`,
      )
    }

    response.status(status).json({ code, message, data: null, traceId })
  }
}
