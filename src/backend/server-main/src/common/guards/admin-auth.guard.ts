/**
 * @file admin-auth.guard.ts
 * @description 管理员守卫:校验 Authorization Bearer access token,过期与非法分别映射错误码 21/20
 * @author TixXin
 * @since 2026-07-20
 */

import {
  CanActivate,
  ConflictException,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'
import { ErrorCode } from '../constants/error-codes'
import { BusinessException } from '../exceptions/business.exception'
import type { AccessTokenPayload } from '../../modules/auth/auth.service'
import { EntityManager } from '@mikro-orm/postgresql'
import { AdminSession } from '../../entities/admin-session.entity'
import { isUUID } from 'class-validator'
import { ContentContext } from '../../entities/content-context.entity'

export interface AuthedRequest extends Request {
  adminUser?: { id: string; username: string; sessionVersion: number; sessionId: string }
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly em: EntityManager,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>()
    const header = request.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      throw new BusinessException(ErrorCode.Unauthorized, '未鉴权:缺少 Bearer token', HttpStatus.UNAUTHORIZED)
    }

    let payload: AccessTokenPayload
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(header.slice('Bearer '.length))
      if (
        typeof payload.sub !== 'string' ||
        !isUUID(payload.sub) ||
        typeof payload.sid !== 'string' ||
        !isUUID(payload.sid) ||
        !Number.isInteger(payload.version)
      )
        throw new Error('invalid identity')
    } catch (error) {
      const expired = error instanceof Error && error.name === 'TokenExpiredError'
      throw new BusinessException(
        expired ? ErrorCode.AccessTokenExpired : ErrorCode.Unauthorized,
        expired ? 'Access token 已过期' : 'Access token 非法',
        HttpStatus.UNAUTHORIZED,
      )
    }
    let session: AdminSession | null
    try {
      session = await this.em.findOne(
        AdminSession,
        { id: payload.sid, adminUser: payload.sub, revokedAt: null, expiresAt: { $gt: new Date() } },
        { populate: ['adminUser'], refresh: true },
      )
    } catch {
      throw new ServiceUnavailableException('登录状态暂时无法校验，请稍后重试')
    }
    if (!session || session.adminUser.sessionVersion !== payload.version)
      throw new BusinessException(ErrorCode.Unauthorized, '会话已失效，请重新登录', HttpStatus.UNAUTHORIZED)
    const admin = session.adminUser
    request.adminUser = {
      id: admin.id,
      username: admin.username,
      sessionVersion: admin.sessionVersion,
      sessionId: session.id,
    }
    if (request.path.startsWith('/api/v1/admin/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const content = await this.em.findOneOrFail(ContentContext, { id: 'default' }, { refresh: true })
      const supplied = request.headers['x-content-context']
      if (content.requireContext && !supplied)
        throw new HttpException('站点数据已恢复，请保留输入并刷新页面后重新读取', HttpStatus.PRECONDITION_REQUIRED)
      if (supplied && supplied !== content.generation)
        throw new ConflictException('站点数据上下文已变化，请保留输入并刷新页面后再编辑')
    }
    return true
  }
}
