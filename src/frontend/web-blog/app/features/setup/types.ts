/**
 * @file types.ts
 * @description 浏览器初始化向导的接口类型，与 server-main 的 /api/v1/setup 契约一致（docs/api.md「初始化向导」），
 *              以及向导第二步「博主资料」的表单草稿
 * @author TixXin
 * @since 2026-10-19
 */
import type { SupportedLocale } from '~~/i18n/localeOptions'

/** GET /api/v1/setup/status：配置了 SETUP_TOKEN 且没有任何管理员时为 true */
export interface SetupStatus {
  needsSetup: boolean
}

/** 向导可选的社交图标，与服务端 SETUP_SOCIAL_ICONS 一致；邮件由联系邮箱单独生成 */
export const SETUP_SOCIAL_ICONS = [
  'lucide:github',
  'lucide:twitter',
  'lucide:globe',
  'lucide:link',
  'lucide:rss',
  'lucide:youtube',
  'lucide:linkedin',
] as const
export type SetupSocialIcon = (typeof SETUP_SOCIAL_ICONS)[number]
/** 站点资料最多 8 条社交链接，留 1 条给联系邮箱 */
export const SETUP_SOCIAL_LIMIT = 7

export interface SetupSocialLink {
  label: string
  href: string
  icon: SetupSocialIcon
}

/** POST /api/v1/setup 请求体；除令牌、登录名与密码外均可省略 */
export interface SetupRequest {
  token: string
  username: string
  password: string
  siteName?: string
  locale?: SupportedLocale
  description?: string
  launchedAt?: string
  ownerName?: string
  ownerTitle?: string
  email?: string
  avatarSource?: 'image' | 'url' | 'cravatar'
  avatarImage?: string
  avatarUrl?: string
  socials?: SetupSocialLink[]
  searchIndexing?: boolean
}

/** 头像来源：字母头像与本地上传都以图片提交，链接与 Cravatar 只保存地址 */
export type SetupAvatarMode = 'letter' | 'upload' | 'cravatar' | 'url'

/** 第二步「博主资料」的表单草稿；跳过时一项都不提交 */
export interface SetupProfileDraft {
  /** 留空时使用登录名 */
  ownerName: string
  ownerTitle: string
  email: string
  avatarMode: SetupAvatarMode
  /** 本地上传裁切后的 data URL */
  avatarUpload: string
  avatarUrl: string
  siteName: string
  description: string
  launchedAt: string
  socials: { icon: SetupSocialIcon; href: string }[]
  searchIndexing: boolean
}

/** 向导页状态：确认中、可填写、已关闭（已初始化或未开启）、状态读取失败 */
export type SetupPhase = 'checking' | 'open' | 'closed' | 'error'
