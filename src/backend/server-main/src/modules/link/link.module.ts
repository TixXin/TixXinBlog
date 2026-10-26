/** @file link.module.ts @description 真实友链、独立规则与公开申请审核模块 */
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { ContentWriteContextGuard } from '../../common/guards/content-write-context.guard'
import { LinkController, AdminLinkController } from './link.controller'
import { LinkApplicationController, AdminLinkApplicationController } from './link-application.controller'
import { LinkApplicationService } from './link-application.service'
import { LinkService } from './link.service'
// 申请控制器先注册，固定路径优先于 `links/:id` 与 `admin/links/:id`。
@Module({
  imports: [AuthModule],
  controllers: [LinkApplicationController, AdminLinkApplicationController, LinkController, AdminLinkController],
  providers: [LinkService, LinkApplicationService, ContentWriteContextGuard],
})
export class LinkModule {}
