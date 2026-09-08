/**
 * @file settings.ts
 * @description 公开站点设置契约与服务不可用时的基础资料，不包含模拟运行指标。
 */
export interface SiteSettingsData {
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
  revision: number
  updatedAt: string
}
export const defaultSiteSettings: SiteSettingsData = {
  name: 'TixXin Blog',
  description: 'TixXin 的个人博客，分享技术文章、项目经验与生活随笔',
  ownerName: 'TixXin',
  ownerTitle: '前端开发工程师，热爱开源与技术分享',
  avatar: '/avatar-photo.webp',
  avatarAlt: 'TixXin 的头像',
  seoTitle: '',
  seoDescription: '',
  announcement: '',
  announcementUpdatedAt: '',
  socials: [],
  revision: 0,
  updatedAt: '',
}
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
