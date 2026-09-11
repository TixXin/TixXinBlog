/** @file notification.controller.ts @description 管理员站内通知入口；公开访客无法访问运行和互动汇总 */
import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { Type } from 'class-transformer'
import { IsIn, IsInt, Min } from 'class-validator'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { NotificationService } from './notification.service'
class NotificationQuery {
  @Type(() => Number) @IsInt() @Min(1) page = 1
  @IsIn(['all', 'unread']) filter: 'all' | 'unread' = 'all'
}
@Controller('admin/notifications')
@UseGuards(AdminAuthGuard)
export class NotificationController {
  constructor(private readonly service: NotificationService) {}
  @Get('summary') summary() {
    return this.service.summary()
  }
  @Get() list(@Query() query: NotificationQuery) {
    return this.service.list(query.page, query.filter)
  }
  @Get(':id') detail(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.service.detail(id)
  }
  @Post(':id/read') read(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.service.read(id)
  }
}
