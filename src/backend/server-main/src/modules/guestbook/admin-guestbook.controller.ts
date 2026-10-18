/** @file admin-guestbook.controller.ts @description 博主留言管理，权限与审核由服务端校验；批量审核与删除逐条校验版本 */
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  Min,
  ValidateNested,
} from 'class-validator'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator'
import { GUESTBOOK_STATUSES } from '../../entities/guestbook-message.entity'
import type { GuestbookStatus } from '../../entities/guestbook-message.entity'
import { GuestbookReadService } from './guestbook-read.service'
import { GuestbookWriteService } from './guestbook-write.service'
import { AdminGuestbookBatchService } from './admin-guestbook-batch.service'
import { DeleteGuestbookDto, GuestbookBodyDto, QueryAdminGuestbookDto, UpdateGuestbookDto } from './guestbook.dto'
/** 单次批量上限，避免一次事务持有过多行锁 */
export const GUESTBOOK_BATCH_LIMIT = 100
export class GuestbookSelectionDto {
  @IsInt() @Min(1) id!: number
  @IsInt() @Min(0) revision!: number
}
export class BatchGuestbookDeleteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(GUESTBOOK_BATCH_LIMIT)
  @ArrayUnique((item: GuestbookSelectionDto | null) => item?.id)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => GuestbookSelectionDto)
  items!: GuestbookSelectionDto[]
}
export class BatchGuestbookModerationDto extends BatchGuestbookDeleteDto {
  @IsIn(GUESTBOOK_STATUSES) status!: GuestbookStatus
}
@Controller('admin/guestbook')
@UseGuards(AdminAuthGuard)
export class AdminGuestbookController {
  constructor(
    private readonly read: GuestbookReadService,
    private readonly write: GuestbookWriteService,
    private readonly batch: AdminGuestbookBatchService,
  ) {}
  @Get() list(@Query() query: QueryAdminGuestbookDto) {
    return this.read.adminList(query)
  }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number) {
    return this.read.detail(id, '', true)
  }
  @Post() create(@Body() body: GuestbookBodyDto, @CurrentAdmin() admin: { id: string }, @Req() request: Request) {
    return this.write.create(body, '', admin.id, this.write.clientContext(request))
  }
  // 批量路由须先于 :id 声明；PATCH/DELETE 使用独立批量动作，整批写一条汇总审计。
  @Patch('batch') batchModerate(@Body() body: BatchGuestbookModerationDto) {
    return this.batch.moderate(body.status, body.items)
  }
  @Delete('batch') batchRemove(@Body() body: BatchGuestbookDeleteDto) {
    return this.batch.remove(body.items)
  }
  @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateGuestbookDto) {
    return this.write.update(id, body)
  }
  @Delete(':id') remove(@Param('id', ParseIntPipe) id: number, @Query() query: DeleteGuestbookDto) {
    return this.write.remove(id, query.revision)
  }
}
