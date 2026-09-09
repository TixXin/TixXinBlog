/** @file admin-guestbook.controller.ts @description 博主留言管理，权限与审核由服务端校验 */
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator'
import { GuestbookReadService } from './guestbook-read.service'
import { GuestbookWriteService } from './guestbook-write.service'
import { DeleteGuestbookDto, GuestbookBodyDto, QueryAdminGuestbookDto, UpdateGuestbookDto } from './guestbook.dto'
@Controller('admin/guestbook')
@UseGuards(AdminAuthGuard)
export class AdminGuestbookController {
  constructor(
    private readonly read: GuestbookReadService,
    private readonly write: GuestbookWriteService,
  ) {}
  @Get() list(@Query() query: QueryAdminGuestbookDto) {
    return this.read.adminList(query)
  }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number) {
    return this.read.detail(id, '', true)
  }
  @Post() create(@Body() body: GuestbookBodyDto, @CurrentAdmin() admin: { id: string }) {
    return this.write.create(body, '', admin.id)
  }
  @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateGuestbookDto) {
    return this.write.update(id, body)
  }
  @Delete(':id') remove(@Param('id', ParseIntPipe) id: number, @Query() query: DeleteGuestbookDto) {
    return this.write.remove(id, query.revision)
  }
}
