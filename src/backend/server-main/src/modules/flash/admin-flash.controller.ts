/**
 * @file admin-flash.controller.ts
 * @description 闪念管理入口：真实管理员才能创建、编辑、归档及删除，并审核闪念评论（单条与批量）
 */
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { VisitorIdHash } from '../../common/decorators/visitor-id.decorator'
import { FLASH_TYPES } from '../../entities/flash-note.entity'
import type { FlashType } from '../../entities/flash-note.entity'
import { AdminFlashService } from './admin-flash.service'
import { AdminFlashCommentService } from './admin-flash-comment.service'
import {
  BatchFlashCommentDeleteDto,
  BatchFlashCommentModerationDto,
  ModerateFlashCommentDto,
  QueryAdminFlashCommentsDto,
} from './dto/moderate-flash-comment.dto'

export class SaveFlashDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  content?: string
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  tags?: string[]
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(9)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  images?: string[]
  @ValidateIf((_object, value) => value !== undefined) @IsIn(FLASH_TYPES) type?: FlashType
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean() isPinned?: boolean
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean() isArchived?: boolean
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean() isDraft?: boolean
}
class QueryAdminFlashesDto {
  @IsOptional() @IsIn(['all', 'draft', 'published', 'archived']) status?: 'all' | 'draft' | 'published' | 'archived'
  @Type(() => Number) @IsInt() @Min(1) page: number = 1
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize: number = 100
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  archived: boolean = false
  @IsString() @IsOptional() @MaxLength(128) search?: string
}

@Controller('admin/flashes')
@UseGuards(AdminAuthGuard)
export class AdminFlashController {
  constructor(
    private readonly flashes: AdminFlashService,
    private readonly comments: AdminFlashCommentService,
  ) {}
  // 评论静态路由须先于 :id 声明，避免 comments 被当作闪念编号。
  @Get('comments')
  listComments(@Query() query: QueryAdminFlashCommentsDto) {
    return this.comments.list(query)
  }
  @Post('comments/batch/moderation')
  batchModerateComments(@Body() body: BatchFlashCommentModerationDto) {
    return this.comments.batchModerate(body.status, body.items)
  }
  @Post('comments/batch/delete')
  batchRemoveComments(@Body() body: BatchFlashCommentDeleteDto) {
    return this.comments.batchRemove(body.items)
  }
  @Get()
  list(@Query() query: QueryAdminFlashesDto, @VisitorIdHash({ optional: true }) visitor: string) {
    return this.flashes.list(query, visitor)
  }
  @Post()
  create(@Body() body: SaveFlashDto) {
    return this.flashes.save(null, body)
  }
  @Get(':id')
  detail(@Param('id') id: string) {
    return this.flashes.detail(id)
  }
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: SaveFlashDto) {
    return this.flashes.save(id, body)
  }
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.flashes.remove(id)
  }
  @Patch(':id/comments/:commentId')
  moderateComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Body() body: ModerateFlashCommentDto,
  ) {
    return this.comments.moderate(id, commentId, body.status, body.expectedStatus)
  }
  @Delete(':id/comments/:commentId')
  removeComment(@Param('id') id: string, @Param('commentId') commentId: string) {
    return this.flashes.removeComment(id, commentId)
  }
}
