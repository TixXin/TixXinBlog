/** @file project.dto.ts @description 项目字段边界；进展与发布状态独立，不接受虚构的外部计数 */
import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator'
import {
  PROJECT_LINK_KINDS,
  PROJECT_PROGRESS,
  PROJECT_STATUSES,
  PROJECT_TAG_COLORS,
} from '../../entities/project.entity'
import type { ProjectLink, ProjectProgress, ProjectStatus, ProjectTag } from '../../entities/project.entity'
const provided = (_object: unknown, value: unknown) => value !== undefined
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)
export class ProjectQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page: number = 1
  @Type(() => Number) @IsInt() @Min(1) @Max(48) pageSize: number = 12
  @ValidateIf(provided) @IsString() @MaxLength(200) @Transform(trim) q?: string
  @ValidateIf(provided) @IsIn(PROJECT_PROGRESS) progress?: ProjectProgress
  @ValidateIf(provided) @IsString() @MinLength(1) @MaxLength(40) @Transform(trim) tag?: string
}
export class AdminProjectQuery extends ProjectQuery {
  @ValidateIf(provided) @IsIn(['all', ...PROJECT_STATUSES]) status?: ProjectStatus | 'all'
}
export class ProjectTagDto implements ProjectTag {
  @IsString() @MinLength(1) @MaxLength(40) @Transform(trim) label!: string
  @IsIn(PROJECT_TAG_COLORS) color!: ProjectTag['color']
}
export class ProjectLinkDto implements ProjectLink {
  @IsIn(PROJECT_LINK_KINDS) kind!: ProjectLink['kind']
  @IsString() @MinLength(1) @MaxLength(2048) @Transform(trim) href!: string
}
export class SaveProjectDto {
  @ValidateIf(provided) @IsUUID('4') requestId?: string
  @ValidateIf(provided) @IsInt() @Min(0) revision?: number
  @ValidateIf(provided) @IsString() @MinLength(1) @MaxLength(160) @Transform(trim) title?: string
  @ValidateIf(provided) @IsString() @MaxLength(5000) @Transform(trim) description?: string
  @ValidateIf((_object, value) => value !== undefined && value !== null) @IsUUID('4') coverMediaId?: string | null
  @ValidateIf(provided)
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProjectTagDto)
  tags?: ProjectTagDto[]
  @ValidateIf(provided)
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => ProjectLinkDto)
  links?: ProjectLinkDto[]
  @ValidateIf(provided) @IsIn(PROJECT_PROGRESS) progress?: ProjectProgress
  @ValidateIf(provided) @IsIn(PROJECT_STATUSES) status?: ProjectStatus
  @ValidateIf(provided) @IsInt() @Min(-1000000) @Max(1000000) sortOrder?: number
}
export class ProjectRevisionDto {
  @Type(() => Number) @IsInt() @Min(0) revision!: number
}
