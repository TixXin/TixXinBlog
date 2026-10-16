/**
 * @file settings.ts
 * @description 公开站点设置契约与服务不可用时的基础资料，不包含模拟运行指标。
 */
import type { AboutSettings } from '~/features/about/types'
export interface SiteSettingsData {
  about?: AboutSettings
  name: string
  description: string
  ownerName: string
  ownerTitle: string
  avatar: string
  avatarAlt: string
  seoTitle: string
  seoDescription: string
  announcement: string
  announcementUpdatedAt: string
  socials: { label: string; href: string; icon: string }[]
  /** 博主当前状态短语，空串表示不展示在线状态 */
  presenceLabel: string
  /** 状态签名 */
  presenceSignature: string
  /** 站点上线日期 YYYY-MM-DD，空串由服务端按最早文章推算 */
  launchedAt: string
  /** 状态类型：空串时有状态文案即按在线展示；idle 为离开，busy 为忙碌 */
  presenceStatus: PresenceStatusSetting
  revision: number
  updatedAt: string
}
// 站点资料服务不可用时的中性兜底；正式值由博主在 /admin/site 维护，此处不写入任何具体站点的身份信息。
export const defaultSiteSettings: SiteSettingsData = {
  name: 'My Blog',
  description: '',
  ownerName: '',
  ownerTitle: '',
  avatar: '/avatar.svg',
  avatarAlt: '博主头像',
  seoTitle: '',
  seoDescription: '',
  announcement: '',
  announcementUpdatedAt: '',
  socials: [],
  presenceLabel: '',
  presenceSignature: '',
  launchedAt: '',
  presenceStatus: '',
  revision: 0,
  updatedAt: '',
}
export type PresenceStatusSetting = '' | 'online' | 'idle' | 'busy'
/** 后台可选的状态类型与公开展示时的默认文案 */
export const presenceStatusOptions: { value: PresenceStatusSetting; label: string }[] = [
  { value: '', label: '自动（有状态文案时显示在线）' },
  { value: 'online', label: '在线' },
  { value: 'idle', label: '离开' },
  { value: 'busy', label: '忙碌' },
]
export const siteSocialIcons = [
  'lucide:github',
  'lucide:twitter',
  'lucide:mail',
  'lucide:globe',
  'lucide:link',
  'lucide:rss',
  'lucide:youtube',
  'lucide:linkedin',
]
