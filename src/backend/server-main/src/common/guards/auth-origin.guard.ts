/**
 * @file auth-origin.guard.ts
 * @description Cookie 认证接口的来源校验，阻止跨站刷新/登出请求
 */
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'

@Injectable()
export class AuthOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    const origin = request.headers.origin
    if (!origin) return true
    const allowed = this.config
      .get<string>('CORS_ORIGIN', '')
      .split(',')
      .map((value) => value.trim())
    try {
      if (allowed.includes(origin) || new URL(origin).host === request.headers.host) return true
    } catch {
      /* 非法来源同样拒绝。 */
    }
    throw new ForbiddenException('不允许跨站认证操作')
  }
}
