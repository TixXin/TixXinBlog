/** @file types.ts @description 跨内容检索类型与分来源分页结果，不使用虚构的统一排名。 */
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
export const searchTypeLabels: Record<SearchScope, string> = {
  all: '全部类型',
  post: '文章',
  project: '项目',
  link: '友链',
  gallery: '图库',
  flash: '闪念',
  moment: '朋友圈',
}
export const SEARCH_PAGE_SIZE = 10
export const SEARCH_PREVIEW_SIZE = 3
