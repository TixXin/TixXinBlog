/** @file admin-moment.controller.ts @description 博主朋友圈管理与评论审核，权限由服务器认证守卫确定 */
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator'
import { VisitorIdHash } from '../../common/decorators/visitor-id.decorator'
import {
  ModerateMomentCommentDto,
  MomentCommentBody,
  MomentPageQuery,
  MomentRevisionDto,
  QueryAdminMomentsDto,
  QueryAdminMomentCommentsDto,
  SaveMomentDto,
} from './moment.dto'
import { MomentReadService } from './moment-read.service'
import { MomentWriteService } from './moment-write.service'
import { MomentInteractionService } from './moment-interaction.service'

@Controller('admin/moments')
@UseGuards(AdminAuthGuard)
export class AdminMomentController {
  constructor(
    private readonly read: MomentReadService,
    private readonly write: MomentWriteService,
    private readonly interactions: MomentInteractionService,
  ) {}
  @Get()
  list(@Query() query: QueryAdminMomentsDto, @VisitorIdHash({ optional: true }) visitor: string) {
    return this.read.list(query, visitor, true)
  }
  @Get('comments')
  allComments(@Query() query: QueryAdminMomentCommentsDto) {
    return this.read.adminComments(query)
  }
  @Get(':id')
  detail(@Param('id') id: string) {
    return this.read.detail(id, '', true)
  }
  @Get('submissions/:requestId')
  submission(@Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string) {
    return this.read.submission(requestId)
  }
  @Post()
  create(@Body() body: SaveMomentDto) {
    return this.write.save(null, body)
  }
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: SaveMomentDto) {
    return this.write.save(id, body)
  }
  @Delete(':id')
  remove(@Param('id') id: string, @Query() query: MomentRevisionDto) {
    return this.write.remove(id, query.revision)
  }
  @Get(':id/comments')
  comments(@Param('id') id: string, @Query() query: MomentPageQuery) {
    return this.read.comments(id, query, '', true)
  }
  @Get(':id/comments/:commentId/location')
  commentLocation(@Param('id') id: string, @Param('commentId') commentId: string) {
    return this.read.commentLocation(id, commentId)
  }
  @Post(':id/comments')
  comment(@Param('id') id: string, @Body() body: MomentCommentBody, @CurrentAdmin() admin: { id: string }) {
    return this.interactions.comment(id, body, '', admin.id)
  }
  @Patch(':id/comments/:commentId')
  moderate(@Param('id') id: string, @Param('commentId') commentId: string, @Body() body: ModerateMomentCommentDto) {
    return this.interactions.moderate(id, commentId, body.status, body.expectedStatus)
  }
  @Delete(':id/comments/:commentId')
  removeComment(@Param('id') id: string, @Param('commentId') commentId: string) {
    return this.interactions.removeComment(id, commentId)
  }
}
