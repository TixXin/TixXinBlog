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
  moderationStatus?: 'published' | 'pending' | 'hidden'
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
  imageAlts?: string[]
  commentCount?: number
  date: string
  likes: number
  isLiked: boolean
  location?: string
  device?: string
  topics?: string[]
  comments?: MomentCommentItem[]
  /** 引用站内文章（与 linkedLink 二选一，linkedArticle 优先） */
  linkedArticle?: MomentLinkedArticle | null
  /** 引用任意外链（OG 卡） */
  linkedLink?: MomentLinkedLink | null
  /** 是否置顶（在列表中前置展示） */
  isPinned?: boolean
  /** 心情标签（emoji + 短文，例如 "🌧️ 微凉"） */
  mood?: string
}

export type MomentStatus = 'draft' | 'published' | 'archived'
export interface MomentPage {
  items: MomentItem[]
  total: number
  page: number
  pageSize: number
}
export interface MomentOverview {
  stats: { totalMoments: number; totalLikes: number; totalComments: number }
  topics: { name: string; count: number }[]
  dates: { date: string; count: number }[]
  photos: { src: string; momentId: string }[]
  recollections: Pick<MomentItem, 'id' | 'content' | 'date'>[]
}
export interface MomentQuery {
  page: number
  pageSize?: number
  q?: string
  topic?: string
  date?: string
}
export interface MomentCommentPage {
  items: MomentCommentItem[]
  total: number
  page: number
  pageSize: number
}
export interface MomentNavigation {
  prev: Pick<MomentItem, 'id' | 'content'> | null
  next: Pick<MomentItem, 'id' | 'content'> | null
}
export interface MomentEditable {
  content: string
  topics: string[]
  images: string[]
  location: string
  device: string
  mood: string
  linkedArticleId: number | null
  linkedLink: MomentLinkedLink | null
  status: MomentStatus
  isPinned: boolean
}
export interface ManagedMoment extends MomentItem {
  status: MomentStatus
  revision: number
  linkedArticleId: number | null
  createdAt: string
  updatedAt: string
}
