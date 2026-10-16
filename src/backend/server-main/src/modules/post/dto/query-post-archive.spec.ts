/** @file query-post-archive.spec.ts @description 轻量统计严格布尔参数与归档查询上下界 */
import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { QueryPostArchiveDto, QueryPostMetadataDto } from './query-post-archive.dto'

describe('文章归档查询边界', () => {
  it('旧统计默认携带归档，仅接受明确布尔值', () => {
    expect(plainToInstance(QueryPostMetadataDto, {}).includeArchive).toBe(true)
    expect(plainToInstance(QueryPostMetadataDto, { includeArchive: 'false' }).includeArchive).toBe(false)
    for (const value of ['0', '', 'FALSE', 'no', ['true', 'false']])
      expect(validateSync(plainToInstance(QueryPostMetadataDto, { includeArchive: value }))).not.toHaveLength(0)
  })

  it('归档默认50条，严格限制年、页码和页大小', () => {
    expect(plainToInstance(QueryPostArchiveDto, {})).toMatchObject({ page: 1, pageSize: 50 })
    expect(validateSync(plainToInstance(QueryPostArchiveDto, { year: '2026', page: '2', pageSize: '100' }))).toEqual([])
    for (const query of [
      { year: '0' },
      { year: '10000' },
      { year: '' },
      { page: '1.5' },
      { page: '0' },
      { pageSize: '101' },
    ])
      expect(validateSync(plainToInstance(QueryPostArchiveDto, query))).not.toHaveLength(0)
  })
})
