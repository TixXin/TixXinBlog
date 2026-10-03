/** @file prompts.module.ts @description 图片提示词分享模块 */
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AuthOriginGuard } from '../../common/guards/auth-origin.guard'
import { AdminPromptsController, PromptsController } from './prompts.controller'
import { PromptsService } from './prompts.service'

@Module({
  imports: [AuthModule],
  controllers: [PromptsController, AdminPromptsController],
  providers: [PromptsService, AuthOriginGuard],
})
export class PromptsModule {}
