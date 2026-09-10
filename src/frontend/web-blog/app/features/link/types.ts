/** @file types.ts @description 友链公开、管理、规则和本站资料契约，推荐不表示互链验证 */
export const linkStatusLabels = { draft: '草稿', published: '已上架', withdrawn: '已下架' } as const
export type LinkStatus = keyof typeof linkStatusLabels
export interface LinkItem {
  id: number
  name: string
  description: string
  url: string
  domain: string
  avatar: string | null
  width: number | null
  height: number | null
  isFeatured: boolean
  publishedAt: string | null
}
export interface LinkEditable {
  name: string
  description: string
  url: string
  logoMediaId: string | null
  logoUrl: string | null
  status: LinkStatus
  isFeatured: boolean
  sortOrder: number
}
export interface ManagedLink extends LinkItem, LinkEditable {
  revision: number
  createdAt: string
  updatedAt: string
}
export interface LinkQuery {
  q?: string
  featured?: 'true' | 'false'
  page: number
  pageSize: number
}
export interface LinkPage<T = LinkItem> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
export interface LinkMetadata {
  stats: { links: number; featured: number; domains: number }
  rules: string[]
}
export interface LinkSettings {
  rules: string[]
  revision: number
  updatedAt: string
}
export interface SiteInfo {
  label: string
  value: string
}
export interface LocalLinkDraft {
  name: string
  url: string
  avatar: string
  description: string
}
