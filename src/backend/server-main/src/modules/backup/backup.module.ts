/**
 * @file backup.module.ts
 * @description 复用现有写入业务与媒体存储接口的内容迁移模块。
 */
import { Module } from '@nestjs/common'
import { PostModule } from '../post/post.module'
import { FlashModule } from '../flash/flash.module'
import { SiteModule } from '../site/site.module'
import { CommentModule } from '../comment/comment.module'
import { MediaModule } from '../media/media.module'
import { BackupController } from './backup.controller'
import { ContentExportService } from './content-export.service'
import { ContentImportService } from './content-import.service'
import { MaintenanceController } from './maintenance.controller'
@Module({
  imports: [PostModule, FlashModule, SiteModule, CommentModule, MediaModule],
  controllers: [BackupController, MaintenanceController],
  providers: [ContentExportService, ContentImportService],
})
export class BackupModule {}
