/** @file types.ts @description 跨内容检索类型与分来源分页结果，不使用虚构的统一排名。 */
import type { Translate } from '~/utils/format'
export const searchTypes = ['post', 'project', 'link', 'gallery', 'flash', 'moment'] as const
export type SearchType = (typeof searchTypes)[number]
export type SearchScope = SearchType | 'all'
export interface SearchResultItem {
  type: SearchType
  id: string
  title: string
  description: string
  url: string
  icon: string
}
export interface SearchGroup {
  type: SearchType
  items: SearchResultItem[]
  total: number | null
  unavailable: boolean
}
export interface SearchSelection {
  query: string
  type: SearchScope
  page: number
}
/** 搜索类型名称的字典 key，界面显示用 searchTypeLabel 按当前语言翻译 */
export const searchTypeLabelKeys: Record<SearchScope, string> = {
  all: 'article.search.types.all',
  post: 'article.search.types.post',
  project: 'article.search.types.project',
  link: 'article.search.types.link',
  gallery: 'article.search.types.gallery',
  flash: 'article.search.types.flash',
  moment: 'article.search.types.moment',
}
/** 当前语言的搜索类型名称；未知类型原样返回 */
export function searchTypeLabel(type: string, t: Translate): string {
  const key = searchTypeLabelKeys[type as SearchScope]
  return key ? t(key) : type
}
export const SEARCH_PAGE_SIZE = 10
export const SEARCH_PREVIEW_SIZE = 3
