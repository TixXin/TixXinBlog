/**
 * @file publicFilter.ts
 * @description 闪念公开分页筛选条件规范化、查询键生成与服务端分页参数映射
 * @author TixXin
 * @since 2026-10-21
 */

import type { FlashNote, FlashPublicPageQuery, FlashType } from '~/features/flash/types'
import { FLASH_PUBLIC_PAGE_SIZE } from '~/features/flash/state'

/** 公开分页的服务端条件：可任意组合，全部为空表示全部公开闪念 */
export interface FlashPublicFilter {
  tag: string | null
  q: string
  type?: FlashType | null
  /** UTC 日（YYYY-MM-DD） */
  date?: string | null
}

/** 规范化筛选条件，空值统一为 null / 空串，便于比较与生成查询键 */
export function normalizeFilter(filter: FlashPublicFilter): Required<FlashPublicFilter> {
  return { tag: filter.tag || null, q: filter.q.trim(), type: filter.type || null, date: filter.date || null }
}

export function filterKey(filter: Required<FlashPublicFilter>): string {
  return JSON.stringify([filter.tag, filter.q, filter.type, filter.date])
}

export function isUnfiltered(filter: Required<FlashPublicFilter>): boolean {
  return !filter.tag && !filter.q && !filter.type && !filter.date
}

export function isPublicNote(note: FlashNote): boolean {
  return !note.isDraft && !note.isArchived
}

export function buildPageQuery(page: number, filter: Required<FlashPublicFilter>): FlashPublicPageQuery {
  return {
    page,
    pageSize: FLASH_PUBLIC_PAGE_SIZE,
    ...(filter.tag ? { tag: filter.tag } : {}),
    ...(filter.q ? { q: filter.q } : {}),
    ...(filter.type ? { type: filter.type } : {}),
    ...(filter.date ? { date: filter.date } : {}),
  }
}
