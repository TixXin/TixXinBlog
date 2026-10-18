/**
 * @file create-flash-comment.dto.ts
 * @description POST /flashes/:id/comments 请求体 DTO
 * @author TixXin
 * @since 2026-07-20
 */

import { Transform } from 'class-transformer'
import { IsString, MaxLength, MinLength, ValidateIf } from 'class-validator'
import { ValidateVisitorSubmissionField } from '../../../common/validation/visitor-submission'

export class CreateFlashCommentDto {
  @ValidateVisitorSubmissionField('website') website?: string
  @ValidateVisitorSubmissionField('formRenderedAt') formRenderedAt?: number
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(32)
  authorName!: string

  @IsString()
  @MaxLength(512)
  @ValidateIf((_object, value) => value !== undefined)
  authorAvatar?: string

  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(500)
  content!: string
}
