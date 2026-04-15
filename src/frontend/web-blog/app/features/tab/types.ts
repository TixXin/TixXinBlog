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
  /** 侧栏折叠状态（List 视图下使用） */
  collapsed?: boolean
  /** 分类描述（可选，用于 tooltip 或 List 视图副标题） */
  description?: string
}

/** 书签条目 */
export interface Bookmark {
  id: string
  userId: string
  /** 显示名 */
  name: string
  /** 跳转 URL */
  url: string
  /** 图标：支持 lucide:xxx / emoji / 单字 / dataURL；为空时按名称首字母生成 */
  icon?: string
  /** 卡片背景色（可选） */
  color?: string
  /** 所属分类 id；空字符串表示未分类 */
  categoryId: string
  /** 同分类内排序权重 */
  sortOrder: number
  /** 自动抓取的 favicon URL（缓存后复用，避免重复请求） */
  faviconUrl?: string
  /** favicon 抓取失败标记，二次加载不再自动重试 */
  faviconFailed?: boolean
  /** 描述（Cards 视图展示） */
  description?: string
  /** 置顶（同分类内排在最前） */
  pinned?: boolean
  /** 创建时间 ISO */
  createdAt?: string
  /** 最近更新时间 ISO */
  updatedAt?: string
}

/** 创建分类时的草稿 */
export interface BookmarkCategoryDraft {
  name: string
  icon: string
  color: string
  description?: string
}

/** 创建书签时的草稿 */
export interface BookmarkDraft {
  name: string
  url: string
  icon?: string
  color?: string
  categoryId: string
  description?: string
}

/** 批量排序更新载荷 */
export interface BookmarkReorderUpdate {
  id: string
  categoryId: string
  sortOrder: number
}

export interface CategoryReorderUpdate {
  id: string
  sortOrder: number
}

/** 导入批量策略 */
export type ImportMode = 'merge' | 'append' | 'replace'

/** 导入载荷（从 JSON 或浏览器 HTML 解析后的中间结构） */
export interface ImportPayload {
  categories: BookmarkCategoryDraft[]
  bookmarks: Array<Omit<BookmarkDraft, 'categoryId'> & { categoryName: string }>
}
