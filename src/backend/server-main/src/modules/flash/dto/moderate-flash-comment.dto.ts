/**
 * @file moderate-flash-comment.dto.ts
 * @description 闪念评论后台审核 DTO:跨闪念列表筛选、单条审核与当前页批量审核/删除;以提交时看到的状态做冲突保护
 */
import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'
import { FLASH_COMMENT_STATUSES } from '../../../entities/flash-comment.entity'
import type { FlashCommentStatus } from '../../../entities/flash-comment.entity'

/** 单次批量上限;与文章评论、留言批量一致 */
export const FLASH_COMMENT_BATCH_LIMIT = 100

export class QueryAdminFlashCommentsDto {
  @IsOptional() @IsIn(['all', ...FLASH_COMMENT_STATUSES]) status: 'all' | FlashCommentStatus = 'all'
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page: number = 1
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize: number = 20
  /** 通知跳转时只定位一条评论 */
  @IsOptional() @IsString() @MinLength(1) @MaxLength(64) commentId?: string
}

export class ModerateFlashCommentDto {
  @IsIn(FLASH_COMMENT_STATUSES) status!: FlashCommentStatus
  @IsIn(FLASH_COMMENT_STATUSES) expectedStatus!: FlashCommentStatus
}

export class FlashCommentSelectionDto {
  @IsString() @MinLength(1) @MaxLength(64) id!: string
  @IsIn(FLASH_COMMENT_STATUSES) expectedStatus!: FlashCommentStatus
}

export class BatchFlashCommentDeleteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(FLASH_COMMENT_BATCH_LIMIT)
  @ArrayUnique((item: FlashCommentSelectionDto | null) => item?.id)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => FlashCommentSelectionDto)
  items!: FlashCommentSelectionDto[]
}

export class BatchFlashCommentModerationDto extends BatchFlashCommentDeleteDto {
  @IsIn(FLASH_COMMENT_STATUSES) status!: FlashCommentStatus
}
