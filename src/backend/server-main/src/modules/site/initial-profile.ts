/** @file initial-profile.ts @description 初始资料精确识别常量，仅供显式整理工具核对，不能作为公开个人事实回退。 */
export const INITIAL_PROFILE_REASON = '初始站点资料'
export const SAFE_INITIAL_PROFILE_REASON = '收起未经确认的初始个人资料'
export const LEGACY_INITIAL_SITE_VALUES = {
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
  socials: [
    { icon: 'lucide:github', label: 'GitHub', href: 'https://github.com/TixXin' },
    { icon: 'lucide:twitter', label: 'Twitter', href: 'https://twitter.com/TixXin' },
    { icon: 'lucide:mail', label: 'Email', href: 'mailto:hi@tix.xin' },
  ],
}
export const EMPTY_INITIAL_ABOUT = { visible: false, introduction: '', sections: [] }
export const SAFE_INITIAL_SITE_VALUES = {
  ...LEGACY_INITIAL_SITE_VALUES,
  ownerName: 'tixxin',
  ownerTitle: '',
  avatar: '/avatar.svg',
  avatarAlt: '博主头像',
  socials: [],
  about: EMPTY_INITIAL_ABOUT,
}
