/** @file presence.module.ts @description 实时在线与访问统计模块：公开心跳、后台开关与访问统计 */
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AdminPresenceController, PresenceController } from './presence.controller'
import { PresenceService } from './presence.service'
import { TrafficService } from './traffic.service'

@Module({
  imports: [AuthModule],
  controllers: [PresenceController, AdminPresenceController],
  providers: [PresenceService, TrafficService],
})
export class PresenceModule {}
