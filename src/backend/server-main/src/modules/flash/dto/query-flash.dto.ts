/**
 * @file query-flash.dto.ts
 * @description GET /flashes 与 GET /flashes/search 查询参数 DTO(api.md §7.6);
 *   标签、类型与 UTC 日期筛选在列表与搜索间通用,可与分页任意组合
 * @author TixXin
 * @since 2026-07-20
 */

import { Transform, Type } from 'class-transformer'
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'
import { FLASH_TYPES, type FlashType } from '../../../entities/flash-note.entity'

/** UTC 日:只接受 YYYY-MM-DD 且必须是真实存在的公历日 */
const UTC_DAY = /^\d{4}-\d{2}-\d{2}$/

export class QueryFlashDto {
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

  @IsString()
  @MaxLength(64)
  @IsOptional()
  userId?: string

  @IsString()
  @MaxLength(64)
  @IsOptional()
  tag?: string

  @IsIn(FLASH_TYPES)
  @IsOptional()
  type?: FlashType

  /** 单日筛选(UTC),与前端发布日历的分组口径一致 */
  @Matches(UTC_DAY)
  @IsDateString({ strict: true })
  @IsOptional()
  date?: string

  /** 起始日(UTC,含当天) */
  @Matches(UTC_DAY)
  @IsDateString({ strict: true })
  @IsOptional()
  from?: string

  /** 截止日(UTC,含当天) */
  @Matches(UTC_DAY)
  @IsDateString({ strict: true })
  @IsOptional()
  to?: string

  /** 契约扩展:true 时返回归档列表(默认仅活跃);已回补至 api.md 变更历史 */
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  @IsOptional()
  archived?: boolean
}

export class SearchFlashDto extends QueryFlashDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  q!: string
}
