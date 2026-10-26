/** @file adminListQuery.ts @description 后台文章列表的路由查询解析、跳转查询构造与状态徽章色调 */
import type { LocationQuery } from 'vue-router'
import type { AdminPostListRow } from './types'

export const ADMIN_POST_PAGE_SIZE = 20
/** 与管理列表 DTO 的 pageSize 上限一致，全选时按此分页读取 */
export const ADMIN_POST_FILTER_PAGE_SIZE = 100

const STATUSES = ['draft', 'published', 'archived', 'trash']
const CATEGORIES = ['tech', 'life']
const SORTS = ['updatedAt', 'publishedAt', 'title']

/** 筛选表单的原始输入，搜索词保留未裁剪的草稿 */
export interface AdminPostListForm {
  search: string
  status: string
  category: string
  folder: string
  tag: string
}

/** 已应用到列表请求的查询：筛选条件与排序 */
export type AdminPostAppliedQuery = Record<string, string | undefined>

export interface ParsedAdminPostListQuery {
  form: AdminPostListForm
  sort: string
  order: string
  page: number
  /** 只由筛选条件组成的键，用于区分「换筛选」与「只翻页或改排序」 */
  criteriaKey: string
  applied: AdminPostAppliedQuery
}

export function normalizeAdminPostSort(value: string) {
  return SORTS.includes(value) ? value : 'updatedAt'
}

export function normalizeAdminPostOrder(value: string) {
  return value === 'asc' ? 'asc' : 'desc'
}

/** 把路由查询解析为表单回填值、排序、页码与已应用查询；非法取值回落到默认值 */
export function parseAdminPostListQuery(query: LocationQuery): ParsedAdminPostListQuery {
  const text = (key: string) => (typeof query[key] === 'string' ? (query[key] as string) : '')
  const form: AdminPostListForm = {
    search: text('search'),
    status: STATUSES.includes(text('status')) ? text('status') : '',
    category: CATEGORIES.includes(text('category')) ? text('category') : '',
    folder: text('folder'),
    tag: text('tag'),
  }
  const criteria = {
    search: form.search.trim() || undefined,
    status: form.status || undefined,
    category: form.category || undefined,
    folder: form.folder || undefined,
    tag: form.tag || undefined,
  }
  const sort = normalizeAdminPostSort(text('sort'))
  const order = normalizeAdminPostOrder(text('order'))
  const page = Number(text('page'))
  return {
    form,
    sort,
    order,
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    criteriaKey: JSON.stringify(criteria),
    applied: { ...criteria, sort, order },
  }
}

/** 提交筛选表单时的目标查询：排序在前，空条件省略，第一页不写页码 */
export function filterNavigationQuery(form: AdminPostListForm, sort: string, order: string, page: number) {
  const query: Record<string, string> = { sort, order }
  for (const [key, value] of Object.entries({ ...form, search: form.search.trim() })) {
    if (value) query[key] = value
  }
  if (page > 1) query.page = String(page)
  return query
}

/** 沿用已应用查询跳到指定页，不把搜索框里未提交的草稿带出去 */
export function appliedPageQuery(applied: AdminPostAppliedQuery, page: number) {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(applied)) if (value) query[key] = value
  if (page > 1) query.page = String(page)
  return query
}

/** 状态徽章的辅助色：已发布绿、草稿橙、回收站红，归档保持中性 */
export function adminPostStatusTone(post: Pick<AdminPostListRow, 'deleted' | 'status'>) {
  if (post.deleted) return 'is-danger'
  return post.status === 'published' ? 'is-success' : post.status === 'draft' ? 'is-warning' : ''
}
