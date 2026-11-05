/**
 * @file types.ts
 * @description 关于页模块类型定义；资料结构与后端 about-settings 一致，v17 起的字段均为可选
 * @author TixXin
 * @since 2025-03-17
 */

export interface SocialLink {
  icon: string
  label: string
  href: string
  primary?: boolean
}

export interface Profile {
  name: string
  avatar: string
  avatarAlt: string
  bio: string
  socials: SocialLink[]
}

export interface ContactItem {
  icon: string
  type: string
  value: string
  href: string
}

/** 条目的英文版本；留空的字段在英文界面回退到中文 */
export interface AboutItemTranslation {
  title: string
  detail: string
  period: string
}
/** 用户自行确认的资料；顺序按数组维护，隐藏内容不由公开 API 返回。 */
export interface AboutItem {
  title: string
  detail: string
  /** 经历的时间段、书单的作者、装备的类别等，含义随栏目而定 */
  period: string
  visible: boolean
  /** 可选的 http(s) 链接，标题渲染为外链 */
  url?: string
  en?: AboutItemTranslation
}
export type AboutSectionKind = 'experience' | 'skill' | 'interest' | 'reading' | 'now' | 'uses'
export interface AboutSection {
  kind: AboutSectionKind
  visible: boolean
  /** 栏目更新日期 YYYY-MM-DD，“现在”栏目展示为“更新于” */
  updatedAt?: string
  items: AboutItem[]
}
export interface AboutSupportMethod {
  label: string
  /** 打赏或赞助页面的 http(s) 地址，空串表示没有 */
  url: string
  /** 收款码等图片：站内媒体路径或 http(s) 地址，空串表示没有 */
  image: string
}
/** 支持方式：关闭或没有可用方式时公开接口省略，页面不展示占位 */
export interface AboutSupport {
  visible: boolean
  message: string
  messageEn?: string
  methods: AboutSupportMethod[]
}
export interface AboutSettings {
  visible: boolean
  introduction: string
  sections: AboutSection[]
  en?: { introduction: string }
  /** 关于页展示本站信息（运行天数与内容统计） */
  showSiteInfo?: boolean
  support?: AboutSupport
}
