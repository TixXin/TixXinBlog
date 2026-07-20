/**
 * @file health.controller.ts
 * @description 健康探针：/health 存活探针 + /ready 就绪探针（依赖检查随模块接入补充）
 * @author TixXin
 * @since 2026-07-20
 */

import { Controller, Get } from '@nestjs/common'

export interface HealthStatus {
  status: 'ok'
  uptimeSeconds: number
  timestamp: string
}

@Controller()
export class HealthController {
  @Get('health')
  health(): HealthStatus {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    }
  }

  /** TODO(实体建模阶段): 就绪检查需真实探测 PostgreSQL / Redis 连接 */
  @Get('ready')
  ready(): HealthStatus {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    }
  }
}
