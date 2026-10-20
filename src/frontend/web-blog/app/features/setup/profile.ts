/**
 * @file profile.ts
 * @description 初始化向导第二步「博主资料」：默认草稿、前端校验与转换为 /api/v1/setup 请求字段；
 *              规则与服务端一致（外部头像仅 https、社交链接 http(s)、Cravatar 需要邮箱）
 * @author TixXin
 * @since 2026-10-20
 */
import type { SupportedLocale } from '~~/i18n/localeOptions'
import type { SetupProfileDraft, SetupRequest, SetupSocialIcon } from './types'

/** 社交链接显示名写入站点资料（业务数据），按所选站点语言给出 */
const SOCIAL_LABELS: Record<SetupSocialIcon, Record<SupportedLocale, string>> = {
  'lucide:github': { 'zh-CN': 'GitHub', en: 'GitHub' },
  'lucide:twitter': { 'zh-CN': 'X', en: 'X' },
  'lucide:globe': { 'zh-CN': '个人网站', en: 'Website' },
  'lucide:link': { 'zh-CN': '链接', en: 'Link' },
  'lucide:rss': { 'zh-CN': 'RSS', en: 'RSS' },
  'lucide:youtube': { 'zh-CN': 'YouTube', en: 'YouTube' },
  'lucide:linkedin': { 'zh-CN': 'LinkedIn', en: 'LinkedIn' },
}

export function socialLabel(icon: SetupSocialIcon, locale: SupportedLocale): string {
  return SOCIAL_LABELS[icon][locale]
}

/** 输入框占位示例：给出各平台的地址形态，省略号处填写自己的账号 */
export const SOCIAL_PLACEHOLDERS: Record<SetupSocialIcon, string> = {
  'lucide:github': 'https://github.com/…',
  'lucide:twitter': 'https://x.com/…',
  'lucide:globe': 'https://…',
  'lucide:link': 'https://…',
  'lucide:rss': 'https://…/rss.xml',
  'lucide:youtube': 'https://youtube.com/@…',
  'lucide:linkedin': 'https://linkedin.com/in/…',
}

/** 本地日期 YYYY-MM-DD，作为建站日期默认值 */
export function localDate(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function createProfileDraft(today = localDate()): SetupProfileDraft {
  return {
    ownerName: '',
    ownerTitle: '',
    email: '',
    avatarMode: 'letter',
    avatarUpload: '',
    avatarUrl: '',
    siteName: '',
    description: '',
    launchedAt: today,
    socials: [],
    searchIndexing: true,
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isUrl(value: string, protocols: string[]): boolean {
  try {
    const url = new URL(value)
    return protocols.includes(url.protocol) && !url.username && !url.password
  } catch {
    return false
  }
}

/** 第二步可定位的字段，社交链接按序号区分 */
export type SetupProfileField = 'email' | 'avatar' | 'avatarUrl' | 'launchedAt' | `social-${number}`
export type SetupProfileProblem =
  | 'emailInvalid'
  | 'avatarUploadMissing'
  | 'avatarEmailRequired'
  | 'avatarUrlInvalid'
  | 'launchedAtInvalid'
  | 'socialUrlInvalid'

/** 返回第一处问题；全部通过时为 null */
export function validateProfile(
  draft: SetupProfileDraft,
): { field: SetupProfileField; problem: SetupProfileProblem } | null {
  const email = draft.email.trim()
  if (email && !EMAIL.test(email)) return { field: 'email', problem: 'emailInvalid' }
  if (draft.avatarMode === 'upload' && !draft.avatarUpload) return { field: 'avatar', problem: 'avatarUploadMissing' }
  if (draft.avatarMode === 'cravatar' && !email) return { field: 'email', problem: 'avatarEmailRequired' }
  if (draft.avatarMode === 'url' && !isUrl(draft.avatarUrl.trim(), ['https:']))
    return { field: 'avatarUrl', problem: 'avatarUrlInvalid' }
  if (draft.launchedAt && !/^\d{4}-\d{2}-\d{2}$/.test(draft.launchedAt))
    return { field: 'launchedAt', problem: 'launchedAtInvalid' }
  const index = draft.socials.findIndex((link) => link.href.trim() && !isUrl(link.href.trim(), ['https:', 'http:']))
  if (index >= 0) return { field: `social-${index}`, problem: 'socialUrlInvalid' }
  return null
}

/**
 * 草稿转为请求字段。字母头像需要画布绘制，由页面生成后通过 letterImage 传入；
 * 空字段不提交，服务端保留当前站点资料
 */
export function profileRequest(
  draft: SetupProfileDraft,
  context: { username: string; locale: SupportedLocale; letterImage?: string },
): Partial<SetupRequest> {
  const text = (value: string) => value.trim() || undefined
  const email = text(draft.email)
  const request: Partial<SetupRequest> = {
    ownerName: text(draft.ownerName) ?? context.username,
    ownerTitle: text(draft.ownerTitle),
    email,
    siteName: text(draft.siteName),
    description: text(draft.description),
    launchedAt: text(draft.launchedAt),
    searchIndexing: draft.searchIndexing,
  }
  if (draft.avatarMode === 'letter' && context.letterImage)
    Object.assign(request, { avatarSource: 'image', avatarImage: context.letterImage })
  else if (draft.avatarMode === 'upload' && draft.avatarUpload)
    Object.assign(request, { avatarSource: 'image', avatarImage: draft.avatarUpload })
  else if (draft.avatarMode === 'cravatar' && email) request.avatarSource = 'cravatar'
  else if (draft.avatarMode === 'url' && text(draft.avatarUrl))
    Object.assign(request, { avatarSource: 'url', avatarUrl: text(draft.avatarUrl) })
  const socials = draft.socials
    .filter((link) => link.href.trim())
    .map((link) => ({ label: socialLabel(link.icon, context.locale), href: link.href.trim(), icon: link.icon }))
  if (socials.length) request.socials = socials
  return Object.fromEntries(Object.entries(request).filter(([, value]) => value !== undefined))
}
