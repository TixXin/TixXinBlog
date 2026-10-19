/**
 * @file visitor-id.decorator.ts
 * @description 参数装饰器：从 X-Visitor-Id 头提取访客 id 并哈希，缺失或格式错误返回 400
 * @author TixXin
 * @since 2026-07-20
 */

import { createParamDecorator, ExecutionContext, HttpStatus } from '@nestjs/common'
import type { Request } from 'express'
import { ErrorCode } from '../constants/error-codes'
import { BusinessException } from '../exceptions/business.exception'
import { hashVisitorId, VISITOR_ID_PATTERN } from '../utils/visitor-id'
import { msg } from '../i18n'

/** 注入访客 id 的 SHA-256 哈希；写接口必须携带 X-Visitor-Id（api.md §5.1） */
export const VisitorIdHash = createParamDecorator(
  (data: { optional?: boolean } | undefined, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>()
    const raw = request.headers['x-visitor-id']
    if (raw === undefined && data?.optional) return ''
    if (typeof raw !== 'string' || !raw.trim()) {
      throw new BusinessException(ErrorCode.ParamMissing, msg('common.visitorIdMissing'), HttpStatus.BAD_REQUEST)
    }
    const visitorId = raw.trim()
    if (!VISITOR_ID_PATTERN.test(visitorId)) {
      throw new BusinessException(ErrorCode.ParamMalformed, msg('common.visitorIdMalformed'), HttpStatus.BAD_REQUEST)
    }
    return hashVisitorId(visitorId)
  },
)
