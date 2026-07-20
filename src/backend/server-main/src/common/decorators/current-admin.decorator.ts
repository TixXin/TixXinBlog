/**
 * @file current-admin.decorator.ts
 * @description 参数装饰器:取 AdminAuthGuard 写入的当前管理员信息
 * @author TixXin
 * @since 2026-07-20
 */

import { createParamDecorator, ExecutionContext, HttpStatus } from '@nestjs/common'
import { ErrorCode } from '../constants/error-codes'
import { BusinessException } from '../exceptions/business.exception'
import type { AuthedRequest } from '../guards/admin-auth.guard'

export const CurrentAdmin = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AuthedRequest>()
  if (!request.adminUser) {
    throw new BusinessException(ErrorCode.Unauthorized, '未鉴权', HttpStatus.UNAUTHORIZED)
  }
  return request.adminUser
})
