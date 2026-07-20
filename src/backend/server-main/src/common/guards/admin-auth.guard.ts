/**
 * @file admin-auth.guard.ts
 * @description 管理员守卫:校验 Authorization Bearer access token,过期与非法分别映射错误码 21/20
 * @author TixXin
 * @since 2026-07-20
 */

import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'
import { ErrorCode } from '../constants/error-codes'
import { BusinessException } from '../exceptions/business.exception'
import type { AccessTokenPayload } from '../../modules/auth/auth.service'

export interface AuthedRequest extends Request {
  adminUser?: { id: string; username: string }
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>()
    const header = request.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      throw new BusinessException(ErrorCode.Unauthorized, '未鉴权:缺少 Bearer token', HttpStatus.UNAUTHORIZED)
    }

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(header.slice('Bearer '.length))
      request.adminUser = { id: payload.sub, username: payload.username }
      return true
    } catch (error) {
      const expired = error instanceof Error && error.name === 'TokenExpiredError'
      throw new BusinessException(
        expired ? ErrorCode.AccessTokenExpired : ErrorCode.Unauthorized,
        expired ? 'Access token 已过期' : 'Access token 非法',
        HttpStatus.UNAUTHORIZED,
      )
    }
  }
}
