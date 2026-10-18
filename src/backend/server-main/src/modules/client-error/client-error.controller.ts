/** @file client-error.controller.ts @description 公开客户端错误入口，仅记录经过脱敏的结构化日志。 */
import { Body, Controller, HttpCode, HttpStatus, Logger, Post, Req } from '@nestjs/common'
import type { Request } from 'express'
import { sanitizeClientErrorText, sanitizeClientErrorUrl } from '../../common/utils/client-error-report'
import { getTraceId } from '../../common/utils/trace-id'
import { ClientErrorDto } from './client-error.dto'

@Controller('client-errors')
export class ClientErrorController {
  private readonly logger = new Logger(ClientErrorController.name)

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  report(@Body() input: ClientErrorDto, @Req() request: Request): { accepted: true } {
    // 只从 DTO 的明确字段创建日志，不记录请求体、请求头、用户身份或任何持久记录。
    this.logger.warn({
      event: 'client_error',
      traceId: getTraceId(request),
      report: {
        source: input.source,
        message: sanitizeClientErrorText(input.message),
        url: sanitizeClientErrorUrl(input.url),
        ...(input.stack === undefined ? {} : { stack: sanitizeClientErrorText(input.stack) }),
        ...(input.info === undefined ? {} : { info: sanitizeClientErrorText(input.info) }),
      },
    })
    return { accepted: true }
  }
}
