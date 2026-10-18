/**
 * @file types.ts
 * @description 站点模块类型定义，包含页脚链接、技术栈、系统状态等接口
 * @author TixXin
 * @since 2025-03-17
 */

export interface FooterLink {
  label: string
  href: string
  /** 非 Nuxt 页面（站外地址或 /rss.xml 等服务端文件）：true 走原生 <a>，false/undefined 走 <NuxtLink> */
  external?: boolean
  /** 是否在新窗口打开 */
  newTab?: boolean
}

/** 站点设置中的页脚链接：站内路径或 http(s) 地址 */
export interface SiteFooterLinkSetting {
  label: string
  url: string
  newTab: boolean
}

export interface PoweredByItem {
  label: string
  href: string
}

export interface SiteStatus {
  pingMs: number | null
  statusText: string
}

/** 博主卡片信息（底部栏展开时展示） */
export interface OwnerCardInfo {
  avatar?: string
  avatarAlt?: string
  /** 博主名称 */
  name: string
  /** 头衔/简介 */
  title: string
  /** 社交链接 */
  socials: { icon: string; label: string; href: string }[]
  /** 每日一言候选列表 */
  quotes: string[]
}

/** 站点公告 */
export interface SiteAnnouncement {
  /** 公告唯一标识 */
  id: string
  /** 公告内容 */
  content: string
  /** 发布日期 */
  date: string
  /** 是否置顶 */
  pinned?: boolean
}

/** 博主在线状态枚举 */
export type OwnerPresence = 'online' | 'idle' | 'busy' | 'offline'

/** 博主在线状态信息 */
export interface OwnerPresenceInfo {
  /** 当前状态 */
  status: OwnerPresence
  /** 状态中文名 */
  label: string
  /** 自定义签名 */
  signature: string
  /** 状态开始时间（ISO 字符串） */
  since: string
}
