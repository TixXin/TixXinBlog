/**
 * @file query-post.dto.ts
 * @description GET /posts 查询参数 DTO，对齐 docs/backend/api.md §7.2
 * @author TixXin
 * @since 2026-07-20
 */

import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

export const POST_QUERY_CATEGORIES = ['tech', 'life', 'all'] as const
export type PostQueryCategory = (typeof POST_QUERY_CATEGORIES)[number]

export const POST_QUERY_SORTS = ['date', 'views', 'likes'] as const
export type PostQuerySort = (typeof POST_QUERY_SORTS)[number]

export class QueryPostDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize: number = 20

  @IsIn(POST_QUERY_CATEGORIES)
  @IsOptional()
  category?: PostQueryCategory

  @IsString()
  @MaxLength(64)
  @IsOptional()
  tag?: string

  @IsString()
  @MaxLength(128)
  @IsOptional()
  search?: string

  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  @IsOptional()
  pinned?: boolean

  @IsIn(POST_QUERY_SORTS)
  @IsOptional()
  sort: PostQuerySort = 'date'

  @IsIn(['asc', 'desc'])
  @IsOptional()
  order: 'asc' | 'desc' = 'desc'
}
