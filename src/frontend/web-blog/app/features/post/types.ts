/**
 * @file types.ts
 * @description 文章模块类型定义，包含标签、文章项、分类 Tab 等接口
 * @author TixXin
 * @since 2025-03-17
 */

export interface PostTag {
  label: string
  color: 'emerald' | 'rose' | 'sky' | 'orange' | 'blue' | 'amber'
}

export interface PostItem {
  slug?: string
  id: number
  title: string
  summary: string
  cover?: string
  tags: PostTag[]
  category: 'tech' | 'life' | 'all'
  readTime: number
  likes: number
  views: number
  comments: number
  date: string
  folder: string
  pinned?: boolean
}

export interface PostTab {
  label: string
  value: string
}

/** 文章正文块（heading 可带 id 供目录与锚点使用） */
export interface ArticleSection {
  type: 'heading' | 'paragraph' | 'code' | 'quote' | 'list'
  level?: number
  text?: string
  language?: string
  items?: string[]
  id?: string
}

export interface ArticleDetail {
  relatedContent?: import('~/features/content-relation/types').RelatedContentItem[]
  slug?: string
  summary?: string
  coverAlt?: string
  seoTitle?: string
  seoDescription?: string
  seoNoindex?: boolean
  id: string
  title: string
  cover: string
  date: string
  category: string
  readTime: string
  views: number
  likes: number
  comments: number
  /** 内容最后修订时间（ISO UTC），不随浏览与点赞变化；演示数据缺省 */
  updatedAt?: string
  tags?: PostTag[]
  /** 摘要为空时后端提供的首段摘录 */
  excerpt?: string
  /** 结构化正文仅在没有 Markdown 原文的旧文章上返回 */
  content?: ArticleSection[]
  contentRaw?: string
}

/** 草稿预览签发结果，仅在当前编辑页面内存中保存。 */
export interface PostPreviewLink {
  token: string
  expiresAt: string
}

/** 预览使用正文详情投影，始终关闭索引和评论。 */
export type PostPreviewDetail = ArticleDetail & {
  toc: TocItem[]
  commentEnabled: false
  seoNoindex: true
}

export interface CommentItem {
  moderationStatus?: 'published' | 'pending'
  id: number
  author: string
  avatar: string
  content: string
  time: string
  likes: number
  liked?: boolean
  isOwner?: boolean
  replies?: CommentItem[]
}

export interface RelatedPost {
  slug?: string
  id: string
  title: string
  date: string
  category: string
}

/** 上下篇范围：全站、仅同专栏，或同专栏为空时由服务端回退全站 */
export type PostNavigationScope = 'all' | 'folder' | 'auto'

export interface PostNavigation {
  prev: RelatedPost | null
  next: RelatedPost | null
  /** 仅 auto 范围返回：true 表示同专栏为空，结果来自全站 */
  fallback?: boolean
}

export interface TocItem {
  id: string
  text: string
  level: number
}

/** 发布前缺少替代文本的正文图片位置，行号与图片序号均从 1 开始。 */
export interface PostImageAltWarning {
  line: number
  imageNumber: number
}

export interface PostSummary {
  activity?: Array<{ date: string; articles: number; comments: number }>
  tags: Array<{ label: string; slug: string; color: string; count: number }>
  categories: Array<{ name: string; count: number }>
  stats: { posts: number; views: number; comments: number; tags: number; siteAgeDays: number }
}

export interface PostArchiveItem {
  id: number
  slug?: string
  seoNoindex?: boolean
  title: string
  folder: string
  date: string
  /** 内容最后修订时间（ISO UTC），供站点地图 lastmod */
  updatedAt?: string
}

/** 兼容旧公开统计与服务端 sitemap 的完整返回。 */
export interface PostMetadata extends PostSummary {
  archive: PostArchiveItem[]
}

export interface PostArchiveQuery {
  year?: number
  month?: number
  page: number
  pageSize: number
}

export interface PostArchivePage {
  items: PostArchiveItem[]
  total: number
  page: number
  pageSize: number
  years: Array<{ year: number; count: number }>
}

export interface PostPage {
  items: PostItem[]
  total: number
  page: number
  pageSize: number
}
