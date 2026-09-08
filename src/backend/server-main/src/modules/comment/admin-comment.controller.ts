/**
 * @file admin-comment.controller.ts
 * @description 评论管理：分页检索、真实博主回复及带级联计数维护的删除
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post as HttpPost,
  Query,
  UseGuards,
} from '@nestjs/common'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator'
import { AdminCommentService } from './admin-comment.service'
import { CommentModerationService } from './comment-moderation.service'
import { COMMENT_STATUSES } from '../../entities/comment.entity'
import type { CommentStatus } from '../../entities/comment.entity'

export class QueryAdminCommentsDto {
  @Type(() => Number) @IsInt() @Min(1) page: number = 1
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize: number = 20
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() postId?: number
  @IsString() @MaxLength(128) @IsOptional() search?: string
  @IsIn(['true']) @IsOptional() unanswered?: string
  @IsIn(COMMENT_STATUSES) @IsOptional() status?: CommentStatus
  @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsOptional() from?: string
  @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsOptional() to?: string
}
export class DeleteAdminCommentDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) expectedFingerprint!: string
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() expectedTotal?: number
}
export class ModerateCommentDto {
  @IsIn(COMMENT_STATUSES) status!: CommentStatus
  @IsInt() @Min(0) revision!: number
  @IsString() @Matches(/^[a-f0-9]{64}$/) expectedFingerprint!: string
}
export class SaveCommentPolicyDto {
  @IsBoolean() requireApproval!: boolean
  @IsInt() @Min(0) revision!: number
}
export class AdminReplyDto {
  @IsString() @MinLength(1) @MaxLength(1000) content!: string
}

@Controller('admin/comments')
@UseGuards(AdminAuthGuard)
export class AdminCommentController {
  constructor(
    private readonly comments: AdminCommentService,
    private readonly moderation: CommentModerationService,
  ) {}
  @Get('policy')
  policy() {
    return this.moderation.policy()
  }
  @Patch('policy')
  savePolicy(@Body() body: SaveCommentPolicyDto) {
    return this.moderation.savePolicy(body)
  }
  @HttpPost(':id/moderation')
  moderate(@Param('id', ParseIntPipe) id: number, @Body() body: ModerateCommentDto) {
    return this.moderation.change(id, body)
  }
  @Get()
  list(@Query() query: QueryAdminCommentsDto) {
    return this.comments.list(query)
  }
  @Get('articles')
  articles() {
    return this.comments.articles()
  }
  @Get(':id/context')
  context(@Param('id', ParseIntPipe) id: number, @Query() query: QueryAdminCommentsDto) {
    return this.comments.context(id, query.page)
  }
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Query() query: DeleteAdminCommentDto) {
    return this.comments.remove(id, query.expectedTotal, query.expectedFingerprint)
  }
  @HttpPost(':id/reply')
  reply(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AdminReplyDto,
    @CurrentAdmin() admin: { id: string; username: string },
  ) {
    return this.comments.reply(id, body.content, admin)
  }
}
