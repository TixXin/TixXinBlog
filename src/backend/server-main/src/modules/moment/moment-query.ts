/**
 * @file moment-query.ts
 * @description 朋友圈查询投影、SQL 字段常量与评论/动态 DTO 格式化纯逻辑
 * @author TixXin
 * @since 2026-10-21
 */
import type { Moment } from '../../entities/moment.entity'
import type { MomentComment } from '../../entities/moment-comment.entity'
import type { Post } from '../../entities/post.entity'
import { managedMediaIds } from '../media/media-references'

export interface CommentRow {
  id: string
  moment_id: string
  author: string
  avatar: string
  content: string
  created_at: Date
  is_owner: boolean
  status: string
}

// 公开投影只用到引用文章的卡片字段与可见性；限定列避免连带读取 Markdown 原文和 JSONB 正文。
export const LINKED_ARTICLE_FIELDS = [
  '*',
  'linkedArticle.id',
  'linkedArticle.slug',
  'linkedArticle.title',
  'linkedArticle.summary',
  'linkedArticle.cover',
  'linkedArticle.status',
  'linkedArticle.deletedAt',
] as const

/** 序列化所需的动态投影：引用文章只保证加载卡片字段 */
export type MomentProjection = Omit<Moment, 'linkedArticle'> & {
  linkedArticle?: Pick<Post, 'id' | 'slug' | 'title' | 'summary' | 'cover' | 'status' | 'deletedAt'> | null
}

// 回顾卡片只展示截断正文与日期。
export const RECOLLECTION_FIELDS = ['id', 'content', 'publishedAt', 'createdAt'] as const

export function momentCommentDto(comment: MomentComment) {
  return {
    id: comment.id,
    author: comment.author,
    avatar: comment.avatar,
    content: comment.content,
    time: comment.createdAt.toISOString(),
    isOwner: comment.isOwner,
    moderationStatus: comment.status,
  }
}

export function formatCommentRow(comment: CommentRow) {
  return {
    id: comment.id,
    author: comment.author,
    avatar: comment.avatar,
    content: comment.content,
    time: new Date(comment.created_at).toISOString(),
    isOwner: comment.is_owner,
    moderationStatus: comment.status,
  }
}

export function formatMomentItem(
  note: MomentProjection,
  comments: CommentRow[],
  counts: { moment_id: string; count: number }[],
  liked: Set<string>,
  alts: Map<string, string>,
  admin: boolean,
) {
  const linked = note.linkedArticle
  return {
    id: note.id,
    content: note.content,
    images: note.images,
    imageAlts: note.images.map((url) => alts.get(managedMediaIds([url])[0] ?? '') ?? ''),
    date: (note.publishedAt ?? note.createdAt).toISOString(),
    location: note.location,
    device: note.device,
    mood: note.mood,
    topics: note.topics,
    likes: note.likes,
    isLiked: liked.has(note.id),
    isPinned: note.isPinned,
    commentCount: counts.find((count) => count.moment_id === note.id)?.count ?? 0,
    comments: comments
      .filter((comment) => comment.moment_id === note.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.id.localeCompare(b.id))
      .map(formatCommentRow),
    linkedArticle:
      linked && linked.status === 'published' && !linked.deletedAt
        ? {
            id: String(linked.id),
            title: linked.title,
            summary: linked.summary,
            cover: linked.cover,
            url: `/articles/${linked.slug || linked.id}`,
          }
        : null,
    linkedLink: note.linkedLink,
    ...(admin
      ? {
          status: note.status,
          revision: note.revision,
          linkedArticleId: linked?.id ?? null,
          createdAt: note.createdAt.toISOString(),
          updatedAt: note.updatedAt.toISOString(),
        }
      : {}),
  }
}
