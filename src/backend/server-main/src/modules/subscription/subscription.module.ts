/** @file subscription.module.ts @description 平台订阅费模块 */
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AdminSubscriptionController, SubscriptionController } from './subscription.controller'
import { SubscriptionService } from './subscription.service'
import { SubscriptionFaviconService } from './subscription-favicon.service'
@Module({
  imports: [AuthModule],
  controllers: [SubscriptionController, AdminSubscriptionController],
  providers: [SubscriptionService, SubscriptionFaviconService],
})
export class SubscriptionModule {}
