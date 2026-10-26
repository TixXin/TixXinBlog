/** @file link-application.dto.ts @description 友链申请输入边界；访客只提交文本，服务器不访问申请中的地址 */
import { Transform, Type } from 'class-transformer'
import { IsIn, IsInt, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator'
import { LINK_APPLICATION_STATUSES } from '../../entities/friend-link-application.entity'
import type { LinkApplicationStatus } from '../../entities/friend-link-application.entity'
import { MaxUtf16Length } from '../../common/validators/max-utf16-length'
import { ValidateVisitorSubmissionField } from '../../common/validation/visitor-submission'
const provided = (_object: unknown, value: unknown) => value !== undefined
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)
export class CreateLinkApplicationDto {
  @IsString() @MinLength(1) @MaxUtf16Length(80) @Transform(trim) name!: string
  @IsString() @MinLength(1) @MaxLength(2048) @Transform(trim) url!: string
  @ValidateIf(provided) @IsString() @MaxUtf16Length(300) @Transform(trim) description?: string
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxUtf16Length(200)
  @Transform(trim)
  contact?: string | null
  @ValidateIf(provided) @IsString() @MaxUtf16Length(1000) @Transform(trim) message?: string
  @ValidateVisitorSubmissionField('website') website?: string
  @ValidateVisitorSubmissionField('formElapsedMs') formElapsedMs?: number
  @ValidateVisitorSubmissionField('formRenderedAt') formRenderedAt?: number
}
export class AdminLinkApplicationQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page: number = 1
  @Type(() => Number) @IsInt() @Min(1) @Max(48) pageSize: number = 20
  @ValidateIf(provided) @IsIn(['all', 'handled', ...LINK_APPLICATION_STATUSES]) status?:
    LinkApplicationStatus | 'handled' | 'all'
}
