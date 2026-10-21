/**
 * @file types.ts
 * @description 文章归档模块类型定义
 * @author TixXin
 * @since 2025-03-17
 */

export type ArchiveCategoryColor = 'emerald' | 'rose' | 'sky' | 'amber' | 'blue' | 'slate' | 'orange'

export interface ArchivePost {
  date: string
  title: string
  category: string
  categoryColor: ArchiveCategoryColor
  href: string
}

export interface ArchiveYear {
  year: number
  shortYear: string
  count: number
  posts: ArchivePost[]
}

export interface ArchiveStat {
  label: string
  value: string
}

export interface CategoryDistribution {
  name: string
  count: number
  percent: number
}

export type CommentStatus = 'published' | 'pending' | 'hidden' | 'spam'

export interface CommentText {
  status: CommentStatus
  revision: number
  id: number
  author: string
  content: string
  depth: number
  isOwner: boolean
  createdAt: string
}

export interface AdminCommentRow extends CommentText {
  visible: boolean
  postId: number
  postTitle: string
  postStatus: 'draft' | 'published' | 'archived'
  parentId: number | null
}

export interface AdminCommentContextData {
  target: CommentText
  ancestors: CommentText[]
  replies: CommentText[]
  total: number
  page: number
  deleteTotal: number
  deleteFingerprint: string
  visibleTotal: number
  approvedVisibleTotal: number
  visible: boolean
  post: { id: number; title: string; status: string }
}
