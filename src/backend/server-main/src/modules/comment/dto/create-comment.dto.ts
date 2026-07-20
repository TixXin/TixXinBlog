/**
 * @file create-comment.dto.ts
 * @description POST /posts/:id/comments 请求体 DTO(api.md §7.2)
 * @author TixXin
 * @since 2026-07-20
 */

import { Type } from 'class-transformer'
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator'

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  author!: string

  @IsString()
  @MaxLength(512)
  @IsOptional()
  avatar?: string

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content!: string

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  parentId?: number
}
