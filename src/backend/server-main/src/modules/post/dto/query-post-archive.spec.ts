/** @file query-post-archive.spec.ts @description 轻量统计严格布尔参数与归档年月、分页查询边界 */
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

  it.each(['1', '3', '12'])('接受同年有效月份 %s 并转换为数字', (month) => {
    const query = plainToInstance(QueryPostArchiveDto, { year: '2026', month })
    expect(validateSync(query)).toEqual([])
    expect(query).toMatchObject({ year: 2026, month: Number(month), page: 1, pageSize: 50 })
  })

  it.each([
    { month: '3' },
    { year: '', month: '3' },
    { year: null, month: '3' },
    { year: '2026', month: '0' },
    { year: '2026', month: '13' },
    { year: '2026', month: '3.5' },
    { year: '2026', month: '1e1' },
    { year: '2026', month: '' },
    { year: '2026', month: '春季' },
    { year: '2026', month: null },
    { year: '2026', month: true },
    { year: '2026', month: ['3'] },
    { year: '2026', month: ['3', '4'] },
    { year: ['2026'], month: '3' },
  ])('拒绝无年份、非法或重复的月份参数：%j', (query) => {
    expect(validateSync(plainToInstance(QueryPostArchiveDto, query))).not.toHaveLength(0)
  })
})
