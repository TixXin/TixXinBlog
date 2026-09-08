/**
 * @file types.ts
 * @description 统计模块类型定义，包含站点统计、标签、分类等接口
 * @author TixXin
 * @since 2025-03-17
 */

export interface SiteStats {
  activity?: { date: string; articles: number; comments: number }[]
  articles: number
  views: string
  comments: number
  tags: number
  uptimeDays: number
}

export interface TagItem {
  name: string
  count: number
  color: string
}

export interface CategoryItem {
  name: string
  count: number
  icon: string
  iconColor: string
  iconBg: string
}
