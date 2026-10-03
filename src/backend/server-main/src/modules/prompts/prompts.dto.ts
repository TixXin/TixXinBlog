/** @file prompts.dto.ts @description 提示词请求边界，内容长度与编辑器及内容包保持一致 */
import { Transform, Type } from 'class-transformer'
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsString, IsUUID, Max, Min, MinLength, ValidateIf } from 'class-validator'
import { MaxUtf16Length } from '../../common/validators/max-utf16-length'
import { IMAGE_PROMPT_STATUSES } from '../../entities/image-prompt.entity'
import type { ImagePromptStatus } from '../../entities/image-prompt.entity'

const provided = (_object: unknown, value: unknown) => value !== undefined
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)
const trimTags = ({ value }: { value: unknown }) =>
  Array.isArray(value) ? value.map((tag: unknown) => (typeof tag === 'string' ? tag.trim() : tag)) : value

export class PromptQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page: number = 1
  @Type(() => Number) @IsInt() @Min(1) @Max(48) pageSize: number = 12
  @ValidateIf(provided) @IsString() @MaxUtf16Length(200) @Transform(trim) q?: string
  @ValidateIf(provided) @IsString() @MinLength(1) @MaxUtf16Length(32) @Transform(trim) tag?: string
  @ValidateIf(provided) @IsString() @MinLength(1) @MaxUtf16Length(80) @Transform(trim) model?: string
}
export class AdminPromptQuery extends PromptQuery {
  @ValidateIf(provided) @IsIn(['all', ...IMAGE_PROMPT_STATUSES]) status?: ImagePromptStatus | 'all'
}
export class SavePromptDto {
  @ValidateIf(provided) @IsUUID('4') requestId?: string
  @ValidateIf(provided) @IsInt() @Min(0) @Max(2147483647) revision?: number
  @ValidateIf(provided) @IsString() @MinLength(1) @MaxUtf16Length(160) @Transform(trim) title?: string
  @ValidateIf(provided) @IsString() @MaxUtf16Length(2000) @Transform(trim) description?: string
  @ValidateIf(provided) @IsString() @MinLength(1) @MaxUtf16Length(30000) @Transform(trim) prompt?: string
  @ValidateIf(provided) @IsString() @MaxUtf16Length(10000) @Transform(trim) negativePrompt?: string
  @ValidateIf(provided) @IsString() @MaxUtf16Length(80) @Transform(trim) model?: string
  @ValidateIf(provided)
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxUtf16Length(32, { each: true })
  @Transform(trimTags)
  tags?: string[]
  @ValidateIf((_object, value) => value !== undefined && value !== null) @IsUUID('4') mediaId?: string | null
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MinLength(1)
  @MaxUtf16Length(2048)
  externalImageUrl?: string | null
  @ValidateIf(provided) @IsString() @MaxUtf16Length(240) @Transform(trim) imageAlt?: string
  @ValidateIf(provided) @IsString() @MaxUtf16Length(2048) @Transform(trim) sourceUrl?: string
  @ValidateIf(provided) @IsIn(IMAGE_PROMPT_STATUSES) status?: ImagePromptStatus
}
