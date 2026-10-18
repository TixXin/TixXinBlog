/**
 * @file create-comment.dto.ts
 * @description POST /posts/:id/comments 请求体 DTO(api.md §7.2)
 * @author TixXin
 * @since 2026-07-20
 */

import { Transform } from 'class-transformer'
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator'
import { numberFromString } from '../../../common/transforms/number-from-string'
import { ValidateVisitorSubmissionField } from '../../../common/validation/visitor-submission'

export class CreateCommentDto {
  @ValidateVisitorSubmissionField('website') website?: string
  @ValidateVisitorSubmissionField('formElapsedMs') formElapsedMs?: number
  /** 旧客户端的表单渲染时间戳，仅校验类型，不再与服务器时钟比较 */
  @ValidateVisitorSubmissionField('formRenderedAt') formRenderedAt?: number
  @IsOptional() @IsUUID('4') requestId?: string
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(32)
  author!: string

  // null 与省略等价：服务层回退默认头像，并与省略头像的重试保持幂等
  @IsString()
  @MaxLength(512)
  @IsOptional()
  avatar?: string | null

  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(1000)
  content!: string

  @Transform(numberFromString)
  @IsInt()
  @Min(1)
  @IsOptional()
  parentId?: number
}
