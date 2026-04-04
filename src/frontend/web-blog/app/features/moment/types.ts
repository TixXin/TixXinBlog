/**
 * @file types.ts
 * @description 朋友圈（Moment）模块类型定义
 * @author TixXin
 * @since 2026-04-04
 */

export interface MomentItem {
  id: string
  content: string
  images?: string[]
  date: string
  likes: number
  isLiked: boolean
  location?: string
  device?: string
}
