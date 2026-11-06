/** @file presence.module.ts @description 实时在线与访问统计模块：公开心跳、后台开关、访问统计、地区查询与近期访问 */
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AdminPresenceController, PresenceController } from './presence.controller'
import { GeoLookup } from './geo-lookup'
import { PresenceService } from './presence.service'
import { RecentVisitsService } from './recent-visits.service'
import { TrafficService } from './traffic.service'

@Module({
  imports: [AuthModule],
  controllers: [PresenceController, AdminPresenceController],
  providers: [PresenceService, TrafficService, GeoLookup, RecentVisitsService],
})
export class PresenceModule {}
