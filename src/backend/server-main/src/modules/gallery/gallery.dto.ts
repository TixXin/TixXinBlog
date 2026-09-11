/** @file gallery.dto.ts @description 图库请求边界；作品尺寸及公开时间禁止客户端伪造 */
import { Transform, Type } from 'class-transformer'
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator'
import { GALLERY_GEAR_ICONS } from '../../entities/gallery-settings.entity'
import type { GalleryGear } from '../../entities/gallery-settings.entity'
import { MaxUtf16Length } from '../../common/validators/max-utf16-length'
import {
  IsDateString,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator'
import { GALLERY_STATUSES } from '../../entities/gallery-photo.entity'
import type { GalleryStatus } from '../../entities/gallery-photo.entity'

const provided = (_object: unknown, value: unknown) => value !== undefined
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)
export class GalleryQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page: number = 1
  @Type(() => Number) @IsInt() @Min(1) @Max(48) pageSize: number = 12
  @ValidateIf(provided) @IsString() @MaxLength(200) @Transform(trim) q?: string
  @ValidateIf(provided) @IsString() @MaxLength(40) @Transform(trim) category?: string
}
export class AdminGalleryQuery extends GalleryQuery {
  @ValidateIf(provided) @IsIn(['all', ...GALLERY_STATUSES]) status?: 'all' | GalleryStatus
}
export class SaveGalleryDto {
  @ValidateIf(provided) @IsUUID('4') requestId?: string
  @ValidateIf(provided) @IsInt() @Min(0) revision?: number
  @ValidateIf((_object, value) => value !== undefined && value !== null) @IsUUID('4') mediaId?: string | null
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxUtf16Length(2048)
  externalUrl?: string | null
  @ValidateIf(provided) @IsString() @MinLength(1) @MaxUtf16Length(160) @Transform(trim) title?: string
  @ValidateIf(provided) @IsString() @MaxUtf16Length(5000) @Transform(trim) description?: string
  @ValidateIf(provided) @IsString() @MaxUtf16Length(40) @Transform(trim) category?: string
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  takenOn?: string | null
  @ValidateIf(provided) @IsString() @MaxUtf16Length(160) @Transform(trim) location?: string
  @ValidateIf(provided) @IsString() @MaxUtf16Length(160) @Transform(trim) device?: string
  @ValidateIf(provided) @IsIn(GALLERY_STATUSES) status?: GalleryStatus
  @ValidateIf(provided) @IsInt() @Min(-1000000) @Max(1000000) sortOrder?: number
}
export class GalleryRevisionDto {
  @Type(() => Number) @IsInt() @Min(0) revision!: number
}

export class GalleryGearDto implements GalleryGear {
  @IsIn(GALLERY_GEAR_ICONS) icon!: GalleryGear['icon']
  @IsString() @MinLength(1) @MaxUtf16Length(80) @Transform(trim) name!: string
  @IsString() @MaxUtf16Length(300) @Transform(trim) description!: string
}
export class SaveGallerySettingsDto {
  @IsInt() @Min(0) revision!: number
  @IsArray() @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => GalleryGearDto) gear!: GalleryGearDto[]
}
