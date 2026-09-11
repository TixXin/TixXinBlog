/** @file content-relations.dto.ts @description 内容关联选择与解析边界，不允许客户端提供目标标题或发布状态。 */
import { Type, Transform } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'
import { CONTENT_RELATION_TYPES } from '../../common/types/content-relation'
import type { ContentRelation, ContentRelationType } from '../../common/types/content-relation'
export class ContentRelationDto implements ContentRelation {
  @IsIn(CONTENT_RELATION_TYPES) type!: ContentRelationType
  @IsInt() @Min(1) @Max(2147483647) id!: number
}
export class ResolveContentRelationsDto {
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ContentRelationDto)
  relatedContent!: ContentRelationDto[]
}
export class QueryContentRelationsDto {
  @IsIn(CONTENT_RELATION_TYPES) type!: ContentRelationType
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  q?: string
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1
}
