/**
 * @file create-flash-comment.dto.ts
 * @description POST /flashes/:id/comments 请求体 DTO
 * @author TixXin
 * @since 2026-07-20
 */

import { Transform } from 'class-transformer'
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateFlashCommentDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(32)
  authorName!: string

  @IsString()
  @MaxLength(512)
  @IsOptional()
  authorAvatar?: string

  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(500)
  content!: string
}
