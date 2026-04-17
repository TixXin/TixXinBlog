/**
 * @file types.ts
 * @description 朋友圈（Moment）模块类型定义
 * @author TixXin
 * @since 2026-04-04
 */

/** 用户简要信息，用于 hover 信息卡展示 */
export interface MomentUserProfile {
  name: string
  avatar: string
  bio?: string
  link?: string
}

/** 朋友圈评论项 */
export interface MomentCommentItem {
  id: string
  author: string
  avatar: string
  content: string
  time: string
  isOwner?: boolean
  /** 评论者详细信息，用于 hover 卡片 */
  profile?: MomentUserProfile
}

/** 引用的文章信息（站内文章） */
export interface MomentLinkedArticle {
  id: string
  title: string
  summary: string
  cover?: string
  url: string
}

/** 引用的任意外链（OG 卡片，无后端时由发布者手填） */
export interface MomentLinkedLink {
  url: string
  title: string
  description?: string
  image?: string
  /** 站点名（如 "GitHub" / "知乎"） */
  siteName?: string
  /** 站点 favicon URL */
  favicon?: string
}

export interface MomentItem {
  id: string
  content: string
  images?: string[]
  date: string
  likes: number
  isLiked: boolean
  location?: string
  device?: string
  topics?: string[]
  comments?: MomentCommentItem[]
  /** 引用站内文章（与 linkedLink 二选一，linkedArticle 优先） */
  linkedArticle?: MomentLinkedArticle
  /** 引用任意外链（OG 卡） */
  linkedLink?: MomentLinkedLink
  /** 是否置顶（在列表中前置展示） */
  isPinned?: boolean
  /** 心情标签（emoji + 短文，例如 "🌧️ 微凉"） */
  mood?: string
}
