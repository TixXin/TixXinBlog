/** @file application.ts @description 友链申请的字段上限、提交前校验与审核筛选，规则与服务端 DTO 保持一致 */
import type { LinkApplicationInput, LinkApplicationStatus } from './types'

/** 与服务端 DTO 一致的 UTF-16 上限，浏览器 maxlength 同样按 UTF-16 计数 */
export const linkApplicationLimits = { name: 80, url: 2048, description: 300, contact: 200, message: 1000 } as const

export function emptyLinkApplication(): LinkApplicationInput {
  return { name: '', url: '', description: '', contact: '', message: '' }
}

/** 去除首尾空白后提交；地址的最终规范化以服务端为准 */
export function trimLinkApplication(input: LinkApplicationInput): LinkApplicationInput {
  return {
    name: input.name.trim(),
    url: input.url.trim(),
    description: input.description.trim(),
    contact: input.contact.trim(),
    message: input.message.trim(),
  }
}

export function linkApplicationValid(input: LinkApplicationInput) {
  const value = trimLinkApplication(input)
  return (
    value.name.length > 0 &&
    /^https?:\/\/[^\s/\\]+\S*$/i.test(value.url) &&
    (Object.keys(linkApplicationLimits) as (keyof LinkApplicationInput)[]).every(
      (field) => value[field].length <= linkApplicationLimits[field],
    )
  )
}

/** 后台审核页的筛选：默认只看待审 */
export const linkApplicationFilters = ['pending', 'handled', 'all'] as const
export type LinkApplicationFilter = (typeof linkApplicationFilters)[number]
export function linkApplicationFilter(value: unknown): LinkApplicationFilter {
  return linkApplicationFilters.includes(value as LinkApplicationFilter) ? (value as LinkApplicationFilter) : 'pending'
}

export function linkApplicationPage(value: unknown) {
  const page = Number(value)
  return Number.isSafeInteger(page) && page >= 1 && page <= 10000 ? page : 1
}

export const linkApplicationStatusKeys: Record<LinkApplicationStatus, string> = {
  pending: 'admin-media.linkApplications.status.pending',
  approved: 'admin-media.linkApplications.status.approved',
  rejected: 'admin-media.linkApplications.status.rejected',
}
