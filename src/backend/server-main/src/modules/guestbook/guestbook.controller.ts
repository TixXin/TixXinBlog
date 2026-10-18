/** @file guestbook.controller.ts @description 公开留言、访客提交及回应，访客身份由已有装饰器在服务器计算 */
import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { ContentWriteContextGuard } from '../../common/guards/content-write-context.guard'
import { VisitorIdHash } from '../../common/decorators/visitor-id.decorator'
import { validateVisitorSubmission } from '../../common/validation/visitor-submission'
import { CreateGuestbookDto, QueryGuestbookDto, SetGuestbookReactionDto } from './guestbook.dto'
import { GuestbookReadService } from './guestbook-read.service'
import { GuestbookWriteService } from './guestbook-write.service'
@Controller('guestbook')
export class GuestbookController {
  constructor(
    private readonly read: GuestbookReadService,
    private readonly write: GuestbookWriteService,
  ) {}
  @Get() list(@Query() query: QueryGuestbookDto, @VisitorIdHash({ optional: true }) visitor: string) {
    return this.read.list(query, visitor)
  }
  @Get('metadata') metadata(@VisitorIdHash({ optional: true }) visitor: string) {
    return this.read.metadata(visitor)
  }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number, @VisitorIdHash({ optional: true }) visitor: string) {
    return this.read.detail(id, visitor)
  }
  @Post() @UseGuards(ContentWriteContextGuard) create(
    @Body() body: CreateGuestbookDto,
    @VisitorIdHash() visitor: string,
    @Req() request: Request,
  ) {
    const submission = validateVisitorSubmission(body)
    return this.write.create(submission, visitor, undefined, this.write.clientContext(request))
  }
  @Put(':id/reactions') @UseGuards(ContentWriteContextGuard) reaction(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SetGuestbookReactionDto,
    @VisitorIdHash() visitor: string,
  ) {
    return this.write.react(id, visitor, body)
  }
}
