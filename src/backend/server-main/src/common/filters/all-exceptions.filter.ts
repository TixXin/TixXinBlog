/**
 * @file all-exceptions.filter.ts
 * @description 全局异常过滤器：所有错误统一包装为 { code, message, data: null, traceId }，message 按请求语言翻译，服务端异常记录堆栈
 * @author TixXin
 * @since 2026-07-20
 */

import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common'
import type { Request, Response } from 'express'
import { redactRequestUrl } from '../../config/logging'
import { ErrorCode, HTTP_STATUS_TO_ERROR_CODE } from '../constants/error-codes'
import { BusinessException } from '../exceptions/business.exception'
import { isLocalizedMessage, messageCode, requestLocale, translate, translateStored } from '../i18n'
import { getTraceId } from '../utils/trace-id'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('AllExceptionsFilter')

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()
    const traceId = getTraceId(request)

    const locale = requestLocale(request)
    let status: number = HttpStatus.INTERNAL_SERVER_ERROR
    let code: number = ErrorCode.ServerError
    let message = translate(locale, 'common.serverError')

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const body = exception.getResponse()
      if (isLocalizedMessage(body)) {
        // 业务文案携带 key：按请求语言渲染，并使用字典为该类冲突登记的稳定业务码。
        message = translate(locale, body.messageKey, body.messageParams)
        code =
          exception instanceof BusinessException
            ? exception.code
            : (messageCode(body.messageKey) ?? HTTP_STATUS_TO_ERROR_CODE[status] ?? ErrorCode.ServerError)
      } else {
        code =
          exception instanceof BusinessException
            ? exception.code
            : (HTTP_STATUS_TO_ERROR_CODE[status] ?? ErrorCode.ServerError)
        // ValidationPipe 的 400 响应把明细放在 response.message 数组里，取首条最有信息量
        if (exception instanceof BusinessException) {
          message = exception.message
        } else if (typeof body === 'string') {
          message = body
        } else if (typeof body === 'object' && body !== null && 'message' in body) {
          const raw = (body as { message: string | string[] }).message
          message = Array.isArray(raw) ? (raw[0] ?? exception.message) : raw
        } else {
          message = exception.message
        }
        // 未携带 key 的字符串（DTO 自定义校验、共享领域包等）若与字典中文一致，同样按请求语言显示。
        message = translateStored(locale, message)
      }
    }

    // 未知异常与所有 5xx 在服务端记录堆栈和 traceId；客户端只收到通用文案与 traceId。
    if (!(exception instanceof HttpException) || status >= 500) {
      this.logger.error(
        { err: exception instanceof Error ? exception : new Error(String(exception)), traceId, status },
        `请求处理异常 ${request.method} ${redactRequestUrl(request.path ?? request.url)}`,
      )
    }

    response.status(status).json({ code, message, data: null, traceId })
  }
}
