/**
 * @file types.ts
 * @description 标签页（Tab Page / iTab-style）模块类型定义
 * @author TixXin
 * @since 2026-04-11
 */

/** 书签分类 */
export interface BookmarkCategory {
  id: string
  userId: string
  /** 分类名称 */
  name: string
  /** lucide 图标名 */
  icon: string
  /** 主题色 */
  color: string
  /** 排序权重 */
  sortOrder: number
}

/** 书签条目 */
export interface Bookmark {
  id: string
  userId: string
  /** 显示名 */
  name: string
  /** 跳转 URL */
  url: string
  /** 图标：可选 emoji / 单字 / favicon URL；为空时按名称首字母生成 */
  icon?: string
  /** 卡片背景色（可选） */
  color?: string
  /** 所属分类 id；空字符串表示未分类 */
  categoryId: string
  /** 同分类内排序权重 */
  sortOrder: number
}

/** 创建分类时的草稿 */
export interface BookmarkCategoryDraft {
  name: string
  icon: string
  color: string
}

/** 创建书签时的草稿 */
export interface BookmarkDraft {
  name: string
  url: string
  icon?: string
  color?: string
  categoryId: string
}
