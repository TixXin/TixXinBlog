/** @file guestbook.module.ts @description 留言板公开与管理业务装配 */
import { Module } from '@nestjs/common'
import { GuestbookReadService } from './guestbook-read.service'
import { GuestbookWriteService } from './guestbook-write.service'
import { GuestbookController } from './guestbook.controller'
import { AdminGuestbookController } from './admin-guestbook.controller'
import { AdminGuestbookBatchService } from './admin-guestbook-batch.service'
import { ContentWriteContextGuard } from '../../common/guards/content-write-context.guard'
@Module({
  controllers: [GuestbookController, AdminGuestbookController],
  providers: [GuestbookReadService, GuestbookWriteService, AdminGuestbookBatchService, ContentWriteContextGuard],
  exports: [GuestbookReadService, GuestbookWriteService],
})
export class GuestbookModule {}
