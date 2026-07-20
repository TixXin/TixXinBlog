/**
 * @file business.exception.ts
 * @description 业务异常：携带 api.md 附录 A 定义的业务错误码与对应 HTTP 状态
 * @author TixXin
 * @since 2026-07-20
 */

import { HttpException, HttpStatus } from '@nestjs/common'

export class BusinessException extends HttpException {
  /** 业务错误码（见 src/common/constants/error-codes.ts 与 api.md 附录 A） */
  readonly code: number

  constructor(code: number, message: string, status: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY) {
    super(message, status)
    this.code = code
  }
}
