/**
 * @file postListQuery.test.ts
 * @description 文章列表查询的默认值、非法输入和可分享状态往返
 * @author TixXin
 * @since 2026-09-07
 */
import { describe, expect, it } from 'vitest'
import { readPostListQuery, writePostListQuery } from '../../app/features/post/listQuery'
describe('文章列表URL', () => {
  it('缺省和非法参数回到有效状态', () => {
    expect(readPostListQuery({ page: '-2', mode: 'unknown', tag: '' })).toEqual({
      page: 1,
      mode: 'pagination',
      tag: null,
      category: null,
    })
    expect(readPostListQuery({ page: '3abc' }).page).toBe(1)
    expect(readPostListQuery({ page: '99999999999' }).page).toBe(10000)
  })
  it('组合筛选与连续页码可以完整往返，默认值不污染URL', () => {
    const state = { page: 3, mode: 'waterfall' as const, tag: 'Vue 3', category: '前端开发' }
    expect(readPostListQuery(writePostListQuery(state))).toEqual(state)
    expect(writePostListQuery(readPostListQuery({}))).toEqual({})
  })
})
