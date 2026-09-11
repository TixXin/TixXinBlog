/**
 * @file save-post.dto.ts
 * @description 文章管理请求：创建和完整编辑使用同一校验契约，发布状态由管理员明确选择
 */
import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Matches,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator'
import { POST_CATEGORIES, POST_STATUSES } from '../../../entities/post.entity'
import type { PostCategory, PostStatus } from '../../../entities/post.entity'
import { ContentRelationDto } from '../../content-relations/content-relations.dto'

export class SavePostDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ContentRelationDto)
  relatedContent?: ContentRelationDto[]
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @Matches(/^(?:[a-z][a-z0-9]*(?:-[a-z0-9]+)*)?$/)
  slug?: string
  @IsOptional() @IsString() @MaxLength(300) coverAlt?: string
  @IsOptional() @IsString() @MaxLength(160) seoTitle?: string
  @IsOptional() @IsString() @MaxLength(320) seoDescription?: string
  @IsOptional() @IsBoolean() seoNoindex?: boolean
  @IsOptional() @IsInt() @Min(0) revision?: number
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(200)
  title!: string

  @IsString()
  @MaxLength(1000)
  summary: string = ''

  @IsString()
  @MaxLength(2048)
  @IsOptional()
  cover?: string

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  folder: string = '随笔日记'

  @IsIn(POST_CATEGORIES)
  category: PostCategory = 'life'

  @IsIn(POST_STATUSES)
  status: PostStatus = 'draft'

  @IsString()
  @MaxLength(200000)
  contentRaw: string = ''

  @IsBoolean()
  pinned: boolean = false

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(300)
  readTimeMinutes: number = 5

  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(64, { each: true })
  tags: string[] = []
}

export class QueryAdminPostsDto {
  @IsIn(POST_CATEGORIES)
  @IsOptional()
  category?: PostCategory

  @IsString()
  @MaxLength(64)
  @IsOptional()
  folder?: string

  @IsString()
  @MaxLength(64)
  @IsOptional()
  tag?: string

  @IsIn(['updatedAt', 'publishedAt', 'title'])
  sort: 'updatedAt' | 'publishedAt' | 'title' = 'updatedAt'

  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc'

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20

  @IsIn([...POST_STATUSES, 'trash'])
  @IsOptional()
  status?: PostStatus | 'trash'

  @IsString()
  @MaxLength(128)
  @IsOptional()
  search?: string
}

export class ExpectedPostRevisionDto {
  @Type(() => Number) @IsInt() @Min(0) revision!: number
}
