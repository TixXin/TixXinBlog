/** @file moment.dto.ts @description 朋友圈请求契约；客户端不能提交作者身份、计数或公开日期 */
import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
  ValidateIf,
} from 'class-validator'
import { MOMENT_STATUSES } from '../../entities/moment.entity'
import type { MomentStatus } from '../../entities/moment.entity'
import { MOMENT_COMMENT_STATUSES } from '../../entities/moment-comment.entity'
import type { MomentCommentStatus } from '../../entities/moment-comment.entity'

const provided = (_object: unknown, value: unknown) => value !== undefined
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)
export class MomentPageQuery {
  @Type(() => Number) @IsInt() @Min(1) page: number = 1
  @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize: number = 15
}
export class QueryMomentsDto extends MomentPageQuery {
  @IsOptional() @IsString() @MaxLength(200) @Transform(trim) q?: string
  @IsOptional() @IsString() @MinLength(1) @MaxLength(40) @Transform(trim) topic?: string
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) date?: string
}
export class QueryAdminMomentsDto extends QueryMomentsDto {
  @IsOptional() @IsIn(['all', ...MOMENT_STATUSES]) status?: 'all' | MomentStatus
}
export class MomentLinkDto {
  @IsString() @MinLength(1) @MaxLength(2048) @Transform(trim) url!: string
  @IsString() @MinLength(1) @MaxLength(160) @Transform(trim) title!: string
  @IsOptional() @IsString() @MaxLength(500) description?: string
  @IsOptional() @IsString() @MaxLength(2048) image?: string
  @IsOptional() @IsString() @MaxLength(80) siteName?: string
  @IsOptional() @IsString() @MaxLength(2048) favicon?: string
}
export class SaveMomentDto {
  @ValidateIf(provided) @IsUUID('4') requestId?: string
  @ValidateIf(provided) @IsInt() @Min(0) revision?: number
  @ValidateIf(provided) @IsString() @MinLength(1) @MaxLength(10000) @Transform(trim) content?: string
  @ValidateIf(provided)
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  topics?: string[]
  @ValidateIf(provided)
  @IsArray()
  @ArrayMaxSize(9)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  images?: string[]
  @IsOptional() @IsString() @MaxLength(160) @Transform(trim) location?: string | null
  @IsOptional() @IsString() @MaxLength(80) @Transform(trim) device?: string | null
  @IsOptional() @IsString() @MaxLength(80) @Transform(trim) mood?: string | null
  @IsOptional() @IsInt() @Min(1) linkedArticleId?: number | null
  @IsOptional() @ValidateNested() @Type(() => MomentLinkDto) linkedLink?: MomentLinkDto | null
  @ValidateIf(provided) @IsIn(MOMENT_STATUSES) status?: MomentStatus
  @ValidateIf(provided) @IsBoolean() isPinned?: boolean
}
export class MomentRevisionDto {
  @Type(() => Number) @IsInt() @Min(0) revision!: number
}
export class SetMomentLikeDto {
  @IsBoolean() liked!: boolean
}
export class MomentCommentBody {
  @IsUUID('4') requestId!: string
  @IsString() @MinLength(1) @MaxLength(1000) @Transform(trim) content!: string
}
export class CreateMomentCommentDto extends MomentCommentBody {
  @IsString() @MinLength(1) @MaxLength(32) @Transform(trim) author!: string
  @IsOptional() @IsString() @MaxLength(2048) avatar?: string
}
export class ModerateMomentCommentDto {
  @IsIn(MOMENT_COMMENT_STATUSES) status!: MomentCommentStatus
}
