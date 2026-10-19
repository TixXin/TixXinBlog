/**
 * @file auth-origin.guard.ts
 * @description Cookie 认证接口的来源校验，阻止跨站刷新/登出请求
 */
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'
import { msg } from '../i18n'

/** 无 Origin（同源导航、服务端调用）或来源在 CORS_ORIGIN 白名单、与请求 Host 相同才放行 */
export function isAllowedAuthOrigin(origin: string | undefined, host: string | undefined, corsOrigin = ''): boolean {
  if (!origin) return true
  const allowed = corsOrigin.split(',').map((value) => value.trim())
  try {
    return allowed.includes(origin) || new URL(origin).host === host
  } catch {
    /* 非法来源同样拒绝。 */
    return false
  }
}

@Injectable()
export class AuthOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    if (isAllowedAuthOrigin(request.headers.origin, request.headers.host, this.config.get<string>('CORS_ORIGIN', '')))
      return true
    throw new ForbiddenException(msg('common.crossSiteAuth'))
  }
}
