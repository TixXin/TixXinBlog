/**
 * @file health.module.ts
 * @description 健康检查模块
 * @author TixXin
 * @since 2026-07-20
 */

import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
