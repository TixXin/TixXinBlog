/**
 * @file types.ts
 * @description 朋友圈（Moment）模块类型定义
 * @author TixXin
 * @since 2026-04-04
 */

/** 朋友圈评论项 */
export interface MomentCommentItem {
  id: string
  author: string
  avatar: string
  content: string
  time: string
  isOwner?: boolean
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
}
