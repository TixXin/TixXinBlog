/** @file initial-profile.ts @description 初始资料精确识别常量，仅供显式整理工具核对，不能作为公开个人事实回退。 */
import type { ApiLocale } from '../../common/i18n'
export const INITIAL_PROFILE_REASON = '初始站点资料'
/** 站点默认语言为 en 时初始资料的修订原因；必须与 20261019120000_localize_initial_site_settings 迁移一致 */
export const INITIAL_PROFILE_REASON_EN = 'Initial site settings'
export const SAFE_INITIAL_PROFILE_REASON = '收起未经确认的初始个人资料'
/**
 * 历史指纹：历史库里那份从未被编辑过的旧初始资料，用于精确识别后安全收起。
 * 这不是默认值，禁止修改；与 20260911225000_sanitize_initial_profile 中的 initial 字符串一一对应，
 * 任何改动都会让已部署的老库认不出旧资料，prepare-personal-profile 整理工具也会随之失效。
 * 注：presenceLabel/presenceSignature/launchedAt 是后加字段，老库的 JSON 里并不存在，
 * 比较时由调用方统一忽略，这里补空串只是为了类型完整。
 */
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
  presenceLabel: '',
  presenceSignature: '',
  launchedAt: '',
  socials: [
    { icon: 'lucide:github', label: 'GitHub', href: 'https://github.com/TixXin' },
    { icon: 'lucide:twitter', label: 'Twitter', href: 'https://twitter.com/TixXin' },
    { icon: 'lucide:mail', label: 'Email', href: 'mailto:hi@tix.xin' },
  ],
}
export const EMPTY_INITIAL_ABOUT = { visible: false, introduction: '', sections: [] }
/**
 * 历史指纹：老库经 20260911225000 迁移收起旧资料后的样子，同样只用于识别，禁止修改。
 * 新建库不会产生这份数据，它只用来判断「老库的初始资料至今仍未被博主编辑」。
 */
export const LEGACY_SANITIZED_SITE_VALUES = {
  ...LEGACY_INITIAL_SITE_VALUES,
  ownerName: 'tixxin',
  ownerTitle: '',
  avatar: '/avatar.svg',
  avatarAlt: '博主头像',
  socials: [],
  about: EMPTY_INITIAL_ABOUT,
}
/**
 * 新建库的中性初始资料：不含任何博主身份，fork 本项目后全新建库即得到这份值。
 * 必须与 20260907180000_add_site_settings 迁移写入的 JSON 保持一致。
 */
export const SAFE_INITIAL_SITE_VALUES = {
  name: 'My Blog',
  description: '',
  ownerName: '博主',
  ownerTitle: '',
  avatar: '/avatar.svg',
  avatarAlt: '博主头像',
  seoTitle: '',
  seoDescription: '',
  announcement: '',
  announcementUpdatedAt: '',
  presenceLabel: '',
  presenceSignature: '',
  launchedAt: '',
  socials: [],
  about: EMPTY_INITIAL_ABOUT,
}
/** 站点默认语言为 en 时的中性初始资料：20261019120000_localize_initial_site_settings 只改写名称与头像说明，其余字段同中文版 */
export const SAFE_INITIAL_SITE_VALUES_EN = {
  ...SAFE_INITIAL_SITE_VALUES,
  ownerName: 'Blogger',
  avatarAlt: 'Blogger avatar',
}
/** 按站点默认语言取未编辑的初始资料与修订原因 */
export function initialSiteProfile(locale: ApiLocale) {
  return locale === 'en'
    ? { values: SAFE_INITIAL_SITE_VALUES_EN, reason: INITIAL_PROFILE_REASON_EN }
    : { values: SAFE_INITIAL_SITE_VALUES, reason: INITIAL_PROFILE_REASON }
}
