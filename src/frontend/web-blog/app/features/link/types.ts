/** @file types.ts @description 友链公开、管理、规则和本站资料契约，推荐不表示互链验证 */
import type { Translate } from '~/utils/format'

/** 友链发布状态的字典 key；键集合同时用于校验状态取值 */
export const linkStatusLabelKeys = {
  draft: 'admin-media.linkStatus.draft',
  published: 'admin-media.linkStatus.published',
  withdrawn: 'admin-media.linkStatus.withdrawn',
} as const
export type LinkStatus = keyof typeof linkStatusLabelKeys
export const linkStatuses = Object.keys(linkStatusLabelKeys) as LinkStatus[]
/** 友链发布状态的界面名称，随当前语言 */
export function linkStatusLabel(status: LinkStatus, t: Translate): string {
  return t(linkStatusLabelKeys[status])
}
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
