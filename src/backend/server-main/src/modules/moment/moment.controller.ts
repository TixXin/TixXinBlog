/** @file moment.controller.ts @description 朋友圈公开入口；仅返回已发布内容，访客写入采用现有身份与限流规范 */
import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common'
import { VisitorIdHash } from '../../common/decorators/visitor-id.decorator'
import { CreateMomentCommentDto, MomentPageQuery, QueryMomentsDto, SetMomentLikeDto } from './moment.dto'
import { MomentReadService } from './moment-read.service'
import { MomentInteractionService } from './moment-interaction.service'

@Controller('moments')
export class MomentController {
  constructor(
    private readonly read: MomentReadService,
    private readonly interactions: MomentInteractionService,
  ) {}
  @Get()
  list(@Query() query: QueryMomentsDto, @VisitorIdHash({ optional: true }) visitor: string) {
    return this.read.list(query, visitor)
  }
  @Get('overview')
  overview() {
    return this.read.overview()
  }
  @Get(':id')
  detail(@Param('id') id: string, @VisitorIdHash({ optional: true }) visitor: string) {
    return this.read.detail(id, visitor)
  }
  @Get(':id/comments')
  comments(
    @Param('id') id: string,
    @Query() query: MomentPageQuery,
    @VisitorIdHash({ optional: true }) visitor: string,
  ) {
    return this.read.comments(id, query, visitor)
  }
  @Post(':id/comments')
  comment(@Param('id') id: string, @Body() body: CreateMomentCommentDto, @VisitorIdHash() visitor: string) {
    return this.interactions.comment(id, body, visitor)
  }
  @Put(':id/like')
  like(@Param('id') id: string, @Body() body: SetMomentLikeDto, @VisitorIdHash() visitor: string) {
    return this.interactions.setLike(id, visitor, body.liked)
  }
}
