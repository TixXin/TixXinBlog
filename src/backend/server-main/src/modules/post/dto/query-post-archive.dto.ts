/** @file query-post-archive.dto.ts @description 文章轻量统计与按年月分页归档的公开查询边界 */
import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsInt, Max, Min, ValidateIf } from 'class-validator'

export class QueryPostMetadataDto {
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  includeArchive: boolean = true
}

export class QueryPostArchiveDto {
  // 指定月份时年份必填，避免把某月误解释为跨年份汇总。
  @ValidateIf((query: QueryPostArchiveDto) => query.year !== undefined || query.month !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9999)
  year?: number

  @Transform(({ value }) => (typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value))
  @ValidateIf((_query, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page: number = 1

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 50
}
