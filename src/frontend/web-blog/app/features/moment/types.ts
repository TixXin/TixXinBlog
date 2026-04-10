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

/** 引用的文章信息 */
export interface MomentLinkedArticle {
  id: string
  title: string
  summary: string
  cover?: string
  url: string
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
  /** 引用的文章 */
  linkedArticle?: MomentLinkedArticle
}
