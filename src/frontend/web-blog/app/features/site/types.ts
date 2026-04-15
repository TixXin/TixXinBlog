/**
 * @file types.ts
 * @description 站点模块类型定义，包含页脚链接、技术栈、系统状态等接口
 * @author TixXin
 * @since 2025-03-17
 */

export interface FooterLink {
  label: string
  href: string
  /** 外链：true 走 <a target="_blank">，false/undefined 走 <NuxtLink> 内部路由 */
  external?: boolean
}

export interface PoweredByItem {
  label: string
  href: string
}

export interface SiteStatus {
  pingMs: number
  statusText: string
}

/** 博主卡片信息（底部栏展开时展示） */
export interface OwnerCardInfo {
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
