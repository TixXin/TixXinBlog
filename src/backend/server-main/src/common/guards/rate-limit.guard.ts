/**
 * @file rate-limit.guard.ts
 * @description 应用级限流：先按真实连接 IP 限制，访客 ID 不能绕过窗口配额
 */
import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request, Response } from 'express'

/** 有界固定窗口计数器，可通过时钟注入验证过期和突发请求。 */
export class RateLimitStore {
  private readonly entries = new Map<string, { count: number; expires: number }>()

  consume(key: string, limit: number, windowMs: number, now = Date.now()): number {
    let entry = this.entries.get(key)
    if (!entry || entry.expires <= now) {
      for (const [oldKey, value] of this.entries) {
        if (value.expires <= now) this.entries.delete(oldKey)
      }
      if (this.entries.size >= 10000 && !this.entries.has(key)) return Math.ceil(windowMs / 1000)
      entry = { count: 0, expires: now + windowMs }
      this.entries.set(key, entry)
    }
    if (entry.count >= limit) return Math.max(1, Math.ceil((entry.expires - now) / 1000))
    entry.count += 1
    return 0
  }
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly store = new RateLimitStore()
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    if (request.method === 'OPTIONS' || ['/health', '/ready'].includes(request.path)) return true
    const login = request.path.endsWith('/auth/login') || request.path.endsWith('/auth/password')
    const refresh = request.path.endsWith('/auth/refresh')
    const view = request.path.endsWith('/view')
    const upload = request.path === '/api/v1/admin/media' && request.method === 'POST'
    const write = !['GET', 'HEAD'].includes(request.method)
    const scope = upload
      ? 'media-upload'
      : login
        ? 'login'
        : refresh
          ? 'refresh'
          : view
            ? 'view'
            : write
              ? 'write'
              : 'read'
    const limit = upload ? 20 : login ? 5 : refresh ? 30 : view ? 60 : write ? 10 : 120
    // 仅测试环境可缩短窗口，生产不能通过错误配置关闭限流。
    const windowMs = this.config.get<string>('NODE_ENV') === 'test' ? 1000 : 60000
    const retryAfter = this.store.consume(`${scope}:${request.ip ?? request.socket.remoteAddress}`, limit, windowMs)
    if (retryAfter) {
      context.switchToHttp().getResponse<Response>().setHeader('Retry-After', String(retryAfter))
      throw new HttpException('操作过于频繁，请稍后重试', HttpStatus.TOO_MANY_REQUESTS)
    }
    return true
  }
}
