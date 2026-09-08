/**
 * @file query-flash.dto.ts
 * @description GET /flashes 与 GET /flashes/search 查询参数 DTO(api.md §7.6)
 * @author TixXin
 * @since 2026-07-20
 */

import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator'

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

  /** 契约扩展:true 时返回归档列表(默认仅活跃);已回补至 api.md 变更历史 */
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  @IsOptional()
  archived?: boolean
}

export class SearchFlashDto extends QueryFlashDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  q!: string
}
