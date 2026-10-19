/**
 * @file settings.ts
 * @description 公开站点设置契约与服务不可用时的基础资料，不包含模拟运行指标。
 */
import type { AboutSettings } from '~/features/about/types'
import type { SiteNavEntry } from '~/features/nav/types'
import { defaultNavigation } from '~/features/nav/routes'
import type { SiteFooterLinkSetting } from './types'
import { currentTranslate } from '~/utils/format'
import { defaultFooterLinks, defaultQuotes } from './footer'
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
  /** 导航：内置模块显隐与顺序，以及少量外链 */
  navigation: SiteNavEntry[]
  /** 页脚链接 */
  footerLinks: SiteFooterLinkSetting[]
  /** 每日一言候选 */
  quotes: string[]
  /** ICP 备案号，空串不展示 */
  icpNumber: string
  /** 备案号链接，空串时指向工信部备案查询 */
  icpUrl: string
  /** 自定义版权文案，空串使用默认格式 */
  copyright: string
  revision: number
  updatedAt: string
}
// 站点资料服务不可用时的中性兜底；正式值由博主在 /admin/site 维护，此处不写入任何具体站点的身份信息。
// 头像替代文本、页脚链接与每日一言的缺省值属于界面文案：用 getter 在取值时按当前界面语言翻译，
// structuredClone 与展开复制得到的是取值当时的普通数据。
export const defaultSiteSettings: SiteSettingsData = {
  name: 'My Blog',
  description: '',
  ownerName: '',
  ownerTitle: '',
  avatar: '/avatar.svg',
  get avatarAlt() {
    return currentTranslate()('layout.site.avatarAlt')
  },
  seoTitle: '',
  seoDescription: '',
  announcement: '',
  announcementUpdatedAt: '',
  socials: [],
  presenceLabel: '',
  presenceSignature: '',
  launchedAt: '',
  presenceStatus: '',
  navigation: defaultNavigation(),
  get footerLinks() {
    return defaultFooterLinks()
  },
  get quotes() {
    return defaultQuotes()
  },
  icpNumber: '',
  icpUrl: '',
  copyright: '',
  revision: 0,
  updatedAt: '',
}
export type PresenceStatusSetting = '' | 'online' | 'idle' | 'busy'
/** 后台可选的状态类型与公开展示时的默认文案 */
export const presenceStatusOptions: { value: PresenceStatusSetting; label: string }[] = (
  [
    ['', 'layout.presence.auto'],
    ['online', 'layout.presence.online'],
    ['idle', 'layout.presence.idle'],
    ['busy', 'layout.presence.busy'],
  ] as const
).map(([value, key]) => ({
  value,
  // 取值时按当前界面语言翻译
  get label() {
    return currentTranslate()(key)
  },
}))
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
