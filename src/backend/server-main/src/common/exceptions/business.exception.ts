/**
 * @file business.exception.ts
 * @description 业务异常：携带 api.md 附录 A 定义的业务错误码与对应 HTTP 状态
 * @author TixXin
 * @since 2026-07-20
 */

import { HttpException, HttpStatus } from '@nestjs/common'
import type { LocalizedMessage } from '../i18n'

export class BusinessException extends HttpException {
  /** 业务错误码（见 src/common/constants/error-codes.ts 与 api.md 附录 A） */
  readonly code: number

  /** message 传 msg(key, params) 时由全局过滤器按请求语言翻译；异常自身的 message 为中文 */
  constructor(code: number, message: string | LocalizedMessage, status: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY) {
    super(message, status)
    this.code = code
  }
}
