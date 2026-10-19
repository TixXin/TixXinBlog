/**
 * @file rate-limit.guard.ts
 * @description 应用级限流：先按真实连接 IP 限制，访客 ID 不能绕过窗口配额
 */
import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request, Response } from 'express'
import { isIP } from 'node:net'
import { isClientErrorPath } from '../utils/client-error-report'
import { msg } from '../i18n'

/** 有界固定窗口计数器，可通过时钟注入验证过期和突发请求。 */
export class RateLimitStore {
  // Map 按插入顺序迭代；新窗口总是重新插入，因此首个条目即最早开启窗口的条目。
  private readonly entries = new Map<string, { count: number; expires: number }>()

  constructor(private readonly capacity = 10000) {}

  get size(): number {
    return this.entries.size
  }

  consume(key: string, limit: number, windowMs: number, now = Date.now()): number {
    let entry = this.entries.get(key)
    if (!entry || entry.expires <= now) {
      if (entry) this.entries.delete(key)
      if (this.entries.size >= this.capacity) this.evict(now)
      entry = { count: 0, expires: now + windowMs }
      this.entries.set(key, entry)
    }
    if (entry.count >= limit) return Math.max(1, Math.ceil((entry.expires - now) / 1000))
    entry.count += 1
    return 0
  }

  /** 表满时先清理已过期条目；仍满则淘汰最早的窗口，新客户端不会因表满被一律拒绝。 */
  private evict(now: number): void {
    for (const [key, value] of this.entries) {
      if (value.expires <= now) this.entries.delete(key)
    }
    for (const key of this.entries.keys()) {
      if (this.entries.size < this.capacity) break
      this.entries.delete(key)
    }
  }
}

/** IPv4 按单地址计数；IPv6 按 /64 归并，避免同一前缀轮换地址绕过配额。 */
export function rateLimitClientKey(address: string | undefined): string {
  if (!address) return 'unknown'
  const value = address.trim().toLowerCase()
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(value)
  if (mapped) return mapped[1]!
  if (!value.includes(':') || isIP(value) !== 6) return value
  const groups = expandIpv6(value)
  if (!groups) return value
  // ::/64 内是回环、IPv4 映射等特殊地址，不归并，避免不同 IPv4 访客共用一个桶。
  if (groups.slice(0, 4).every((part) => part === '0')) return groups.join(':')
  return `${groups.slice(0, 4).join(':')}::/64`
}

function expandIpv6(value: string): string[] | null {
  // 内嵌 IPv4 的非映射写法极少见，直接按原值计数。
  const address = value.split('%')[0]!
  if (address.includes('.')) return null
  const [head, rest, extra] = address.split('::')
  if (extra !== undefined) return null
  const left = head ? head.split(':') : []
  const right = rest ? rest.split(':') : []
  const groups =
    rest === undefined ? left : [...left, ...Array<string>(8 - left.length - right.length).fill('0'), ...right]
  if (groups.length !== 8) return null
  return groups.map((part) => Number.parseInt(part || '0', 16).toString(16))
}

/** 初始化向导每个客户端在一个窗口内的提交次数上限，比登录（每分钟 5 次）更严格 */
export const SETUP_RATE_LIMIT = 5

/** 限流关闭开关：仅 development/test 且显式 true 时生效。 */
function rateLimitDisabled(config: ConfigService): boolean {
  const environment = config.get<string>('NODE_ENV') ?? 'production'
  return ['development', 'test'].includes(environment) && config.get<string>('RATE_LIMIT_DISABLED') === 'true'
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly store = new RateLimitStore()
  private readonly clientErrorStore = new RateLimitStore()
  // 全局配额独立存储，不能被大量新 IP 挤出后重新计数。
  private readonly clientErrorGlobalStore = new RateLimitStore(1)
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    // 本机开发需显式 RATE_LIMIT_DISABLED=true 才关闭限流；生产忽略该开关，漏配 NODE_ENV 时按生产处理。
    if (rateLimitDisabled(this.config)) return true
    const request = context.switchToHttp().getRequest<Request>()
    if (request.method === 'OPTIONS' || ['/health', '/ready'].includes(request.path)) return true
    if (request.method === 'POST' && isClientErrorPath(request.path)) {
      const client = rateLimitClientKey(request.ip ?? request.socket.remoteAddress)
      const retryAfter =
        this.clientErrorStore.consume(client, 5, 60000) ||
        this.clientErrorGlobalStore.consume('client-errors', 100, 60000)
      if (retryAfter) this.reject(context, retryAfter)
      return true
    }
    // 初始化向导提交：令牌是高熵随机值，配额只需挡住滥用；按 IP 每 10 分钟 5 次，独立于登录与普通写入。
    if (request.method === 'POST' && /^\/api\/v1\/setup\/?$/.test(request.path)) {
      const setupWindowMs = this.config.get<string>('NODE_ENV') === 'test' ? 1000 : 600000
      const retryAfter = this.store.consume(
        `setup:${rateLimitClientKey(request.ip ?? request.socket.remoteAddress)}`,
        SETUP_RATE_LIMIT,
        setupWindowMs,
      )
      if (retryAfter) this.reject(context, retryAfter)
      return true
    }
    const login = request.path.endsWith('/auth/login') || request.path.endsWith('/auth/password')
    const refresh = request.path.endsWith('/auth/refresh')
    const view = request.path.endsWith('/view')
    const upload = request.path === '/api/v1/admin/media' && request.method === 'POST'
    const write = !['GET', 'HEAD'].includes(request.method)
    const media =
      !write &&
      (request.path.startsWith('/api/v1/media/') ||
        /^\/api\/v1\/subscriptions\/favicons\/[a-f0-9]{64}\.webp$/.test(request.path))
    const admin = /^\/api\/v1\/admin(?:\/|$)/.test(request.path)
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
              : media
                ? 'media-read'
                : admin
                  ? 'admin-read'
                  : 'read'
    const limit = upload ? 20 : login ? 5 : refresh ? 30 : view ? 60 : write ? 10 : media ? 600 : admin ? 300 : 120
    // 仅测试环境可缩短窗口，生产不能通过错误配置关闭限流。
    const windowMs = this.config.get<string>('NODE_ENV') === 'test' ? 1000 : 60000
    const retryAfter = this.store.consume(
      `${scope}:${rateLimitClientKey(request.ip ?? request.socket.remoteAddress)}`,
      limit,
      windowMs,
    )
    if (retryAfter) this.reject(context, retryAfter)
    return true
  }

  private reject(context: ExecutionContext, retryAfter: number): never {
    context.switchToHttp().getResponse<Response>().setHeader('Retry-After', String(retryAfter))
    throw new HttpException(msg('common.rateLimited'), HttpStatus.TOO_MANY_REQUESTS)
  }
}
