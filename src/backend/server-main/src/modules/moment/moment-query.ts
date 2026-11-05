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
import { MOMENT_REACTIONS } from '../../entities/moment-reaction.entity'

export interface CommentRow {
  id: string
  moment_id: string
  author: string
  avatar: string
  content: string
  created_at: Date
  is_owner: boolean
  status: string
  reply_to_id?: string | null
  reply_author?: string | null
  reply_status?: string | null
  reply_deleted_at?: Date | null
}

/**
 * 回复目标的投影：只公开仍可见目标的昵称；目标待审、隐藏或已删除时只标明“回复了一条不可见的评论”，
 * 不泄露原作者或正文。管理端可见全部。
 */
export function replyProjection(
  target: { id: string; author: string; status: string; deletedAt?: Date | null } | null | undefined,
  admin = false,
) {
  if (!target) return null
  const visible = admin || (target.status === 'published' && !target.deletedAt)
  return visible ? { id: target.id, author: target.author } : { id: null, author: null }
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

/** 足迹：公开动态中出现过的地点及动态数，最多 20 个 */
export const MOMENT_LOCATIONS_SQL = `select location as name,count(*)::int as count from moment
where status='published' and deleted_at is null and coalesce(location,'')<>''
group by location order by count desc,location asc limit 20`

/** 回顾卡片：截断正文与发布日期 */
export function recollectionDto(note: Pick<Moment, 'id' | 'content' | 'publishedAt' | 'createdAt'>) {
  return { id: note.id, content: note.content.slice(0, 300), date: (note.publishedAt ?? note.createdAt).toISOString() }
}

// 回顾卡片只展示截断正文与日期。
export const RECOLLECTION_FIELDS = ['id', 'content', 'publishedAt', 'createdAt'] as const

export interface ReactionRow {
  moment_id: string
  emoji: string
  count: number
  reacted: boolean
}

/** 回应按固定顺序列出有记录的表情；reacted 只对当前访客有意义 */
export function formatReactions(rows: ReactionRow[], momentId: string) {
  return MOMENT_REACTIONS.flatMap((emoji) => {
    const row = rows.find((item) => item.moment_id === momentId && item.emoji === emoji)
    return row && row.count > 0 ? [{ emoji, count: row.count, reacted: !!row.reacted }] : []
  })
}

export function momentCommentDto(comment: MomentComment, admin = false) {
  return {
    id: comment.id,
    author: comment.author,
    avatar: comment.avatar,
    content: comment.content,
    time: comment.createdAt.toISOString(),
    isOwner: comment.isOwner,
    moderationStatus: comment.status,
    replyTo: replyProjection(comment.replyTo, admin),
  }
}

export function formatCommentRow(comment: CommentRow, admin = false) {
  return {
    id: comment.id,
    author: comment.author,
    avatar: comment.avatar,
    content: comment.content,
    time: new Date(comment.created_at).toISOString(),
    isOwner: comment.is_owner,
    moderationStatus: comment.status,
    replyTo: comment.reply_to_id
      ? (replyProjection(
          comment.reply_author === null || comment.reply_author === undefined
            ? null
            : {
                id: comment.reply_to_id,
                author: comment.reply_author,
                status: comment.reply_status ?? 'hidden',
                deletedAt: comment.reply_deleted_at,
              },
          admin,
        ) ?? { id: null, author: null })
      : null,
  }
}

export function formatMomentItem(
  note: MomentProjection,
  comments: CommentRow[],
  counts: { moment_id: string; count: number }[],
  liked: Set<string>,
  alts: Map<string, string>,
  admin: boolean,
  reactions: ReactionRow[] = [],
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
    reactions: formatReactions(reactions, note.id),
    isPinned: note.isPinned,
    commentCount: counts.find((count) => count.moment_id === note.id)?.count ?? 0,
    comments: comments
      .filter((comment) => comment.moment_id === note.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.id.localeCompare(b.id))
      .map((comment) => formatCommentRow(comment, admin)),
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
