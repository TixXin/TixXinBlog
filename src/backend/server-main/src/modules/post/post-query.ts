/**
 * @file post-query.ts
 * @description 文章查询过滤条件构造、排序、修订时间计算及 DTO 组装
 * @author TixXin
 * @since 2026-10-21
 */
import type { FilterQuery } from '@mikro-orm/core'
import type { Post, PostContentSection } from '../../entities/post.entity'
import type { QueryPostDto } from './dto/query-post.dto'
import type { resolveContentRelations } from '../content-relations/content-relations'

/** 文章不存在（api.md 附录 A：1001 / 404） */
export const POST_NOT_FOUND = 1001

/** 列表项，字段对齐前端 features/post/types.ts 的 PostItem */
export interface PostItemDto {
  slug?: string
  id: number
  title: string
  summary: string
  cover?: string
  tags: Array<{ label: string; color: string }>
  category: string
  readTime: number
  likes: number
  views: number
  comments: number
  date: string
  folder: string
  pinned: boolean
}

/** 详情，字段对齐前端 ArticleDetail（含 toc 扩展） */
export interface ArticleDetailDto {
  /** 内容最后修订时间（ISO UTC），不受浏览、点赞与评论计数影响 */
  updatedAt: string
  tags: PostItemDto['tags']
  /** 仅在摘要为空时提供，取首个正文段落前 160 字，供描述与分享兜底 */
  excerpt?: string
  relatedContent?: Awaited<ReturnType<typeof resolveContentRelations>>
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
  /** 结构化正文仅在没有 Markdown 原文的旧文章上返回，避免同一正文传输两遍 */
  content?: PostContentSection[]
  contentRaw?: string
  toc: Array<{ id: string; text: string; level: number }>
}

export interface PostListResult {
  items: PostItemDto[]
  total: number
  page: number
  pageSize: number
}

/** 浏览计数结果：counted 表示本次是否计入（同一访客每小时只计一次） */
export interface PostViewResult {
  views: number
  likes: number
  liked: boolean
  counted: boolean
}

/** 内容修订时间早于发布时间（如预约或回填发布日期）时按发布时间计，缺修订记录的旧数据同样回退。 */
export function contentUpdatedAt(publishedAt: Date, revisedAt?: Date | null): Date {
  return revisedAt && revisedAt > publishedAt ? revisedAt : publishedAt
}

export const SORT_FIELD_MAP = { date: 'publishedAt', views: 'views', likes: 'likes' } as const

export type PostListSource = Pick<
  Post,
  | 'id'
  | 'slug'
  | 'title'
  | 'summary'
  | 'cover'
  | 'category'
  | 'readTimeMinutes'
  | 'likes'
  | 'views'
  | 'commentCount'
  | 'publishedAt'
  | 'folder'
  | 'pinned'
> & { tags: { getItems(): PostItemDto['tags'] } }

export function buildPostWhere(query: QueryPostDto): FilterQuery<Post> {
  const where: FilterQuery<Post> = { status: 'published', deletedAt: null }
  if (query.category && query.category !== 'all') where.category = query.category
  if (query.pinned !== undefined) where.pinned = query.pinned
  if (query.folder) where.folder = query.folder
  if (query.tag) where.tags = { slug: query.tag }
  if (query.search) {
    // 与其他公开内容域保持字面检索，保留正文和标签搜索。
    const kw = '%' + query.search.replace(/[\\%_]/g, (char) => '\\' + char) + '%'
    where.$or = [
      { title: { $ilike: kw } },
      { summary: { $ilike: kw } },
      { contentRaw: { $ilike: kw } },
      { tags: { label: { $ilike: kw } } },
    ]
  }
  return where
}

export function toPostItemDto(post: PostListSource): PostItemDto {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    cover: post.cover ?? undefined,
    tags: post.tags.getItems().map((t) => ({ label: t.label, color: t.color })),
    category: post.category,
    readTime: post.readTimeMinutes,
    likes: post.likes,
    views: post.views,
    comments: post.commentCount,
    date: post.publishedAt.toISOString(),
    folder: post.folder,
    pinned: post.pinned,
  }
}
