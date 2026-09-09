/**
 * @file health.controller.ts
 * @description 健康探针：/health 存活探针 + /ready 就绪探针（依赖检查随模块接入补充）
 * @author TixXin
 * @since 2026-07-20
 */

import { Controller, Get, NotFoundException, Req, ServiceUnavailableException } from '@nestjs/common'
import { EntityManager } from '@mikro-orm/postgresql'
import type { Request } from 'express'
import { devIdentity } from './dev-identity'

export interface HealthStatus {
  status: 'ok'
  uptimeSeconds: number
  timestamp: string
}

@Controller()
export class HealthController {
  constructor(private readonly em: EntityManager) {}
  @Get('dev/identity')
  identity(@Req() request: Request) {
    if (
      process.env.NODE_ENV !== 'development' ||
      !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress ?? '')
    )
      throw new NotFoundException()
    return devIdentity()
  }
  @Get('health')
  health(): HealthStatus {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    }
  }

  /** 检测当前业务必需的 PostgreSQL，连接失败时对编排器返回 503。 */
  @Get('ready')
  async ready(): Promise<HealthStatus> {
    try {
      await this.em.getConnection().execute('select 1')
      return this.health()
    } catch {
      throw new ServiceUnavailableException('数据库尚未就绪')
    }
  }
}
