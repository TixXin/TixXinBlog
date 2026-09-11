/** @file moment-feed-query.spec.ts @description 朋友圈订阅排序参数保持页面默认行为，并拒绝模糊布尔输入 */
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { QueryAdminMomentsDto, QueryMomentsDto } from './moment.dto'

describe('朋友圈订阅排序参数', () => {
  it('缺省保留公开列表和管理列表的置顶优先行为', () => {
    expect(plainToInstance(QueryMomentsDto, {}).pinnedFirst).toBe(true)
    expect(plainToInstance(QueryAdminMomentsDto, {}).pinnedFirst).toBe(true)
  })

  it.each([
    ['false', false],
    ['true', true],
  ])('将查询字符串 %s 转为明确布尔值', (input, expected) => {
    const query = plainToInstance(QueryMomentsDto, { pinnedFirst: input, pageSize: '30' })
    expect(validateSync(query)).toHaveLength(0)
    expect(query.pinnedFirst).toBe(expected)
    expect(query.pageSize).toBe(30)
  })

  it.each(['0', '1', '', 'off', null, ['false']])('拒绝不支持的排序参数 %j', (input) => {
    const query = plainToInstance(QueryMomentsDto, { pinnedFirst: input })
    expect(validateSync(query).map((error) => error.property)).toContain('pinnedFirst')
  })
})
