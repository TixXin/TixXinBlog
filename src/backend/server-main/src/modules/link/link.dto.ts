/** @file link.dto.ts @description 友链输入边界，域名与公开日期由服务器推导 */
import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator'
import { LINK_STATUSES } from '../../entities/friend-link.entity'
import type { LinkStatus } from '../../entities/friend-link.entity'
const provided = (_object: unknown, value: unknown) => value !== undefined
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)
export class LinkQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page: number = 1
  @Type(() => Number) @IsInt() @Min(1) @Max(48) pageSize: number = 12
  @ValidateIf(provided) @IsString() @MaxLength(200) @Transform(trim) q?: string
  @ValidateIf(provided) @IsIn(['true', 'false']) featured?: 'true' | 'false'
}
export class AdminLinkQuery extends LinkQuery {
  @ValidateIf(provided) @IsIn(['all', ...LINK_STATUSES]) status?: LinkStatus | 'all'
}
export class SaveLinkDto {
  @ValidateIf(provided) @IsUUID('4') requestId?: string
  @ValidateIf(provided) @IsInt() @Min(0) revision?: number
  @ValidateIf(provided) @IsString() @MinLength(1) @MaxLength(80) @Transform(trim) name?: string
  @ValidateIf(provided) @IsString() @MaxLength(300) @Transform(trim) description?: string
  @ValidateIf(provided) @IsString() @MinLength(1) @MaxLength(2048) @Transform(trim) url?: string
  @ValidateIf((_object, value) => value !== undefined && value !== null) @IsUUID('4') logoMediaId?: string | null
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  @Transform(trim)
  logoUrl?: string | null
  @ValidateIf(provided) @IsIn(LINK_STATUSES) status?: LinkStatus
  @ValidateIf(provided) @IsBoolean() isFeatured?: boolean
  @ValidateIf(provided) @IsInt() @Min(-1000000) @Max(1000000) sortOrder?: number
}
export class LinkRevisionDto {
  @Type(() => Number) @IsInt() @Min(0) revision!: number
}
export class SaveLinkSettingsDto {
  @IsInt() @Min(0) revision!: number
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(300, { each: true })
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value.map((item: unknown) => (typeof item === 'string' ? item.trim() : item)) : value,
  )
  rules!: string[]
}
