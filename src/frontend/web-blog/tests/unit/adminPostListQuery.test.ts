// @vitest-environment node
/** @file adminPostListQuery.test.ts @description 后台文章列表查询解析、跳转查询、状态色调与全选分页读取的纯函数回归 */
import { describe, expect, it, vi } from 'vitest'
import {
  adminPostStatusTone,
  appliedPageQuery,
  filterNavigationQuery,
  parseAdminPostListQuery,
} from '../../app/features/post/adminListQuery'
import { FilterChangedError, readAllFilteredPosts } from '../../app/features/post/adminSelectAll'
import type { AdminPostListRow } from '../../app/features/post/types'

describe('parseAdminPostListQuery', () => {
  it('非法取值回落默认值，搜索草稿保留原文、已应用查询裁剪空白', () => {
    const parsed = parseAdminPostListQuery({
      search: '  Vue  ',
      status: 'deleted',
      category: 'life',
      folder: '开发笔记',
      tag: ['a', 'b'],
      sort: 'views',
      order: 'up',
      page: '1.5',
    })
    expect(parsed.form).toEqual({ search: '  Vue  ', status: '', category: 'life', folder: '开发笔记', tag: '' })
    expect(parsed).toMatchObject({ sort: 'updatedAt', order: 'desc', page: 1 })
    expect(parsed.applied).toEqual({
      search: 'Vue',
      status: undefined,
      category: 'life',
      folder: '开发笔记',
      tag: undefined,
      sort: 'updatedAt',
      order: 'desc',
    })
  })

  it('筛选键只由筛选条件决定，翻页和排序不改变它', () => {
    const base = parseAdminPostListQuery({ status: 'draft', tag: 'Vue' })
    const paged = parseAdminPostListQuery({ status: 'draft', tag: 'Vue', page: '8', sort: 'title', order: 'asc' })
    expect(paged.criteriaKey).toBe(base.criteriaKey)
    expect(paged).toMatchObject({ page: 8, sort: 'title', order: 'asc' })
    expect(parseAdminPostListQuery({ status: 'published', tag: 'Vue' }).criteriaKey).not.toBe(base.criteriaKey)
  })
})

describe('跳转查询', () => {
  it('提交筛选时排序在前、省略空条件与第一页，搜索词裁剪空白', () => {
    const form = { search: ' Nuxt ', status: '', category: 'tech', folder: '', tag: 'Vue' }
    expect(Object.entries(filterNavigationQuery(form, 'title', 'asc', 1))).toEqual([
      ['sort', 'title'],
      ['order', 'asc'],
      ['search', 'Nuxt'],
      ['category', 'tech'],
      ['tag', 'Vue'],
    ])
    expect(filterNavigationQuery(form, 'title', 'asc', 3).page).toBe('3')
  })

  it('翻页沿用已应用查询并省略空值与第一页', () => {
    const applied = { search: undefined, status: 'draft', sort: 'updatedAt', order: 'desc' }
    expect(appliedPageQuery(applied, 1)).toEqual({ status: 'draft', sort: 'updatedAt', order: 'desc' })
    expect(appliedPageQuery(applied, 2)).toEqual({ status: 'draft', sort: 'updatedAt', order: 'desc', page: '2' })
  })
})

it('状态徽章色调：回收站优先，归档中性', () => {
  expect(adminPostStatusTone({ deleted: true, status: 'published' })).toBe('is-danger')
  expect(adminPostStatusTone({ deleted: false, status: 'published' })).toBe('is-success')
  expect(adminPostStatusTone({ deleted: false, status: 'draft' })).toBe('is-warning')
  expect(adminPostStatusTone({ deleted: false, status: 'archived' })).toBe('')
})

describe('readAllFilteredPosts', () => {
  const row = (id: number) => ({ id, revision: 1 }) as AdminPostListRow
  const rows = (from: number, count: number) => Array.from({ length: count }, (_, index) => row(from + index))
  const messages = { changed: () => '筛选结果已变化', reordered: () => '筛选结果顺序已变化' }

  it('按页读完并保持顺序', async () => {
    const read = vi.fn(async (page: number) => ({ items: page === 1 ? rows(1, 2) : rows(3, 1), total: 3 }))
    const result = await readAllFilteredPosts({ read, expectedTotal: 3, pageSize: 2, isCurrent: () => true, messages })
    expect(result?.map((item) => item.id)).toEqual([1, 2, 3])
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('总数或页内条数变化、出现重复编号时抛出可展示的提示', async () => {
    const options = { expectedTotal: 3, pageSize: 2, isCurrent: () => true, messages }
    await expect(
      readAllFilteredPosts({ ...options, read: async () => ({ items: rows(1, 2), total: 4 }) }),
    ).rejects.toThrow(new FilterChangedError('筛选结果已变化'))
    await expect(
      readAllFilteredPosts({ ...options, read: async () => ({ items: rows(1, 1), total: 3 }) }),
    ).rejects.toThrow('筛选结果已变化')
    await expect(
      readAllFilteredPosts({
        ...options,
        read: async (page) => ({ items: page === 1 ? rows(1, 2) : [row(2)], total: 3 }),
      }),
    ).rejects.toThrow('筛选结果顺序已变化')
  })

  it('读取期间被取消时返回 null，不校验也不继续读取', async () => {
    let current = true
    const read = vi.fn(async () => {
      current = false
      return { items: [], total: 99 }
    })
    const result = await readAllFilteredPosts({
      read,
      expectedTotal: 3,
      pageSize: 2,
      isCurrent: () => current,
      messages,
    })
    expect(result).toBeNull()
    expect(read).toHaveBeenCalledTimes(1)
  })
})
