/** @file guestbook.dto.ts @description 留言请求契约；身份、计数、时间和已读状态不由客户端决定 */
import { Transform, Type } from 'class-transformer'
import {
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
  ValidateIf,
} from 'class-validator'
import { GUESTBOOK_STATUSES } from '../../entities/guestbook-message.entity'
import type { GuestbookStatus } from '../../entities/guestbook-message.entity'
import { GUESTBOOK_REACTIONS } from '../../entities/guestbook-reaction.entity'
import type { GuestbookReactionKind } from '../../entities/guestbook-reaction.entity'
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)
export class GuestbookFilters {
  @IsOptional() @IsString() @MaxLength(200) @Transform(trim) q?: string
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) date?: string
}
export class QueryGuestbookDto extends GuestbookFilters {
  @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20
  @IsOptional() @IsString() @MaxLength(400) @Matches(/^[a-zA-Z0-9_-]+$/) before?: string
}
export class QueryAdminGuestbookDto extends GuestbookFilters {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1
  @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20
  @IsOptional() @IsIn(['all', ...GUESTBOOK_STATUSES]) status?: GuestbookStatus | 'all'
}
export class GuestbookBodyDto {
  @IsUUID('4') requestId!: string
  @IsString() @MinLength(1) @MaxLength(500) @Transform(trim) content!: string
  @IsOptional() @IsInt() @Min(1) @Max(2147483647) replyToId?: number | null
}
export class CreateGuestbookDto extends GuestbookBodyDto {
  @IsString() @MinLength(1) @MaxLength(32) @Transform(trim) author!: string
  @IsOptional() @IsString() @MaxLength(2048) avatar?: string
}
export class UpdateGuestbookDto {
  @IsInt() @Min(0) revision!: number
  @ValidateIf((_object, value) => value !== undefined) @IsIn(GUESTBOOK_STATUSES) status?: GuestbookStatus
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean() isPinned?: boolean
}
export class DeleteGuestbookDto {
  @Type(() => Number) @IsInt() @Min(0) revision!: number
}
export class SetGuestbookReactionDto {
  @IsIn(GUESTBOOK_REACTIONS) emoji!: GuestbookReactionKind
  @IsBoolean() reacted!: boolean
}
