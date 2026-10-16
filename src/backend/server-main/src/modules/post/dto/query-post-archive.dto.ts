/** @file query-post-archive.dto.ts @description 文章轻量统计与按年分页归档的公开查询边界 */
import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator'

export class QueryPostMetadataDto {
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  includeArchive: boolean = true
}

export class QueryPostArchiveDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9999)
  @IsOptional()
  year?: number

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
