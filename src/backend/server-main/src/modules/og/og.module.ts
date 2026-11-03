/**
 * @file og.module.ts
 * @description 分享卡片模块：复用文章、闪念、朋友圈的公开详情读取，站点资料与受管媒体读取。
 */
import { Module } from '@nestjs/common'
import { FlashModule } from '../flash/flash.module'
import { MediaModule } from '../media/media.module'
import { MomentModule } from '../moment/moment.module'
import { PostModule } from '../post/post.module'
import { SiteModule } from '../site/site.module'
import { OgController } from './og.controller'
import { OgContentService } from './og-content.service'
import { OgService } from './og.service'

@Module({
  imports: [PostModule, FlashModule, MomentModule, SiteModule, MediaModule],
  controllers: [OgController],
  providers: [OgService, OgContentService],
})
export class OgModule {}
