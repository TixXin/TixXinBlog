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
  /** 博主是否开放公开友链申请 */
  applicationsEnabled: boolean
}
export interface LinkSettings {
  rules: string[]
  applicationsEnabled: boolean
  revision: number
  updatedAt: string
}
/** 访客提交的申请字段；联系方式只给博主查看 */
export interface LinkApplicationInput {
  name: string
  url: string
  description: string
  contact: string
  message: string
}
export type LinkApplicationStatus = 'pending' | 'approved' | 'rejected'
export interface LinkApplication extends Omit<LinkApplicationInput, 'contact'> {
  id: string
  domain: string
  contact: string | null
  status: LinkApplicationStatus
  handledAt: string | null
  createdLinkId: number | null
  createdAt: string
}
export interface LinkApplicationPage extends LinkPage<LinkApplication> {
  pendingTotal: number
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
