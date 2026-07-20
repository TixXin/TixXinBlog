/**
 * @file post.service.ts
 * @description 文章业务逻辑：分页列表、详情映射、点赞切换、浏览 1 小时去重计数
 * @author TixXin
 * @since 2026-07-20
 */

import { FilterQuery, UniqueConstraintViolationException } from '@mikro-orm/core'
import { EntityManager } from '@mikro-orm/postgresql'
import { HttpStatus, Injectable } from '@nestjs/common'
import { BusinessException } from '../../common/exceptions/business.exception'
import { Post, PostContentSection } from '../../entities/post.entity'
import { PostLike } from '../../entities/post-like.entity'
import { PostView } from '../../entities/post-view.entity'
import { QueryPostDto } from './dto/query-post.dto'

/** 文章不存在（api.md 附录 A：1001 / 404） */
const POST_NOT_FOUND = 1001

/** 列表项，字段对齐前端 features/post/types.ts 的 PostItem */
export interface PostItemDto {
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
  id: string
  title: string
  cover: string
  date: string
  category: string
  readTime: string
  views: number
  likes: number
  comments: number
  content: PostContentSection[]
  toc: Array<{ id: string; text: string; level: number }>
}

export interface PostListResult {
  items: PostItemDto[]
  total: number
  page: number
  pageSize: number
}

const SORT_FIELD_MAP = { date: 'publishedAt', views: 'views', likes: 'likes' } as const

@Injectable()
export class PostService {
  constructor(private readonly em: EntityManager) {}

  async findMany(query: QueryPostDto): Promise<PostListResult> {
    const where: FilterQuery<Post> = { status: 'published' }
    if (query.category && query.category !== 'all') where.category = query.category
    if (query.pinned !== undefined) where.pinned = query.pinned
    if (query.tag) where.tags = { slug: query.tag }
    if (query.search) {
      // 兜底实现：ILIKE 模糊匹配；Meilisearch 接入后（search 模块）替换
      const kw = `%${query.search}%`
      where.$or = [{ title: { $ilike: kw } }, { summary: { $ilike: kw } }]
    }

    const [posts, total] = await this.em.findAndCount(Post, where, {
      populate: ['tags'],
      orderBy: { [SORT_FIELD_MAP[query.sort]]: query.order },
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    })

    return {
      items: posts.map((p) => this.toPostItem(p)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    }
  }

  async findDetail(id: number): Promise<ArticleDetailDto> {
    const post = await this.em.findOne(Post, { id, status: 'published' }, { populate: ['tags'] })
    if (!post) throw new BusinessException(POST_NOT_FOUND, '文章不存在', HttpStatus.NOT_FOUND)

    const content = post.contentSections ?? []
    return {
      id: String(post.id),
      title: post.title,
      cover: post.cover ?? '',
      date: post.publishedAt.toISOString(),
      // 契约约定：详情页 category 展示专栏名（api.md §7.2 示例为"前端开发"）
      category: post.folder,
      readTime: `${post.readTimeMinutes} 分钟`,
      views: post.views,
      likes: post.likes,
      comments: post.commentCount,
      content,
      toc: content
        .filter((s) => s.type === 'heading' && s.id && s.text)
        .map((s) => ({ id: s.id as string, text: s.text as string, level: s.level ?? 2 })),
    }
  }

  /** 点赞切换：已点过则取消，未点过则 +1（唯一索引兜底并发） */
  async toggleLike(id: number, visitorIdHash: string): Promise<{ liked: boolean; likes: number }> {
    const post = await this.em.findOne(Post, { id, status: 'published' })
    if (!post) throw new BusinessException(POST_NOT_FOUND, '文章不存在', HttpStatus.NOT_FOUND)

    const existing = await this.em.findOne(PostLike, { post, visitorIdHash })
    if (existing) {
      this.em.remove(existing)
      post.likes = Math.max(0, post.likes - 1)
      await this.em.flush()
      return { liked: false, likes: post.likes }
    }

    try {
      this.em.create(PostLike, { post, visitorIdHash, createdAt: new Date() })
      post.likes += 1
      await this.em.flush()
      return { liked: true, likes: post.likes }
    } catch (error) {
      // 并发双击导致唯一冲突：视为已点赞，返回当前状态
      if (error instanceof UniqueConstraintViolationException) {
        return { liked: true, likes: post.likes }
      }
      throw error
    }
  }

  /** 浏览计数：同一访客同一小时只计一次（api.md §7.2） */
  async addView(id: number, visitorIdHash: string): Promise<{ views: number }> {
    const post = await this.em.findOne(Post, { id, status: 'published' })
    if (!post) throw new BusinessException(POST_NOT_FOUND, '文章不存在', HttpStatus.NOT_FOUND)

    const hourBucket = new Date()
    hourBucket.setMinutes(0, 0, 0)

    const seen = await this.em.findOne(PostView, { post, visitorIdHash, hourBucket })
    if (seen) return { views: post.views }

    try {
      this.em.create(PostView, { post, visitorIdHash, hourBucket, createdAt: new Date() })
      post.views += 1
      await this.em.flush()
    } catch (error) {
      if (!(error instanceof UniqueConstraintViolationException)) throw error
    }
    return { views: post.views }
  }

  private toPostItem(post: Post): PostItemDto {
    return {
      id: post.id,
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
}
