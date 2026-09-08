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
  content: ArticleSection[]
  contentRaw?: string
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

export interface TocItem {
  id: string
  text: string
  level: number
}

export interface PostMetadata {
  activity?: Array<{ date: string; articles: number; comments: number }>
  tags: Array<{ label: string; slug: string; color: string; count: number }>
  categories: Array<{ name: string; count: number }>
  stats: { posts: number; views: number; comments: number; tags: number; uptimeDays: number }
  archive: Array<{ id: number; slug?: string; seoNoindex?: boolean; title: string; folder: string; date: string }>
}

export interface PostPage {
  items: PostItem[]
  total: number
  page: number
  pageSize: number
}
