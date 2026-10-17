/**
 * @file post.service.ts
 * @description 文章业务逻辑：分页列表、详情映射、点赞切换、浏览 1 小时去重计数
 * @author TixXin
 * @since 2026-07-20
 *
 * 公开详情的 updatedAt 取当前修订快照的写入时间：实体 updatedAt 会随浏览、点赞与评论计数变化，
 * 不能代表内容修改时间，直接用于 dateModified 与站点地图 lastmod 会造成无意义的频繁变更。
 */

import { FilterQuery, LockMode } from '@mikro-orm/core'
import { EntityManager } from '@mikro-orm/postgresql'
import { HttpStatus, Injectable } from '@nestjs/common'
import { BusinessException } from '../../common/exceptions/business.exception'
import { Post, PostContentSection } from '../../entities/post.entity'
import { PostLike } from '../../entities/post-like.entity'
import { PostView } from '../../entities/post-view.entity'
import { PostAddress } from '../../entities/post-address.entity'
import { PostRevision } from '../../entities/post-revision.entity'
import { QueryPostDto } from './dto/query-post.dto'
import { resolveContentRelations } from '../content-relations/content-relations'

/** 文章不存在（api.md 附录 A：1001 / 404） */
const POST_NOT_FOUND = 1001

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

const SORT_FIELD_MAP = { date: 'publishedAt', views: 'views', likes: 'likes' } as const
type PostListSource = Pick<
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

@Injectable()
export class PostService {
  constructor(private readonly em: EntityManager) {}

  async findMany(query: QueryPostDto): Promise<PostListResult> {
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

    const [posts, total] = await this.em.findAndCount(Post, where, {
      // 列表仅读取投影使用的字段；正文仍参与 WHERE 检索，避免多标签联表重复取回长正文。
      fields: [
        'id',
        'slug',
        'title',
        'summary',
        'cover',
        'category',
        'readTimeMinutes',
        'likes',
        'views',
        'commentCount',
        'publishedAt',
        'folder',
        'pinned',
        'tags.label',
        'tags.color',
      ],
      populate: ['tags'],
      orderBy: [
        ...(query.pinnedFirst ? [{ pinned: 'desc' as const }] : []),
        { [SORT_FIELD_MAP[query.sort]]: query.order },
        { id: query.order },
      ],
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
    const post = await this.em.findOne(
      Post,
      { id, status: 'published', deletedAt: null },
      { populate: ['tags'], fields: ['*', 'tags.label', 'tags.color'] },
    )
    if (!post) throw new BusinessException(POST_NOT_FOUND, '文章不存在', HttpStatus.NOT_FOUND)

    const [relatedContent, revision] = await Promise.all([
      resolveContentRelations(this.em, post.relatedContent),
      this.em.findOne(PostRevision, { post: post.id, revision: post.revision }, { fields: ['createdAt'] }),
    ])
    const sections = post.contentSections ?? []
    const excerpt = post.summary
      ? undefined
      : sections.find((section) => section.type === 'paragraph' && section.text)?.text?.slice(0, 160)
    return {
      id: String(post.id),
      relatedContent,
      slug: post.slug,
      summary: post.summary,
      ...(excerpt ? { excerpt } : {}),
      coverAlt: post.coverAlt,
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      seoNoindex: post.seoNoindex,
      title: post.title,
      cover: post.cover ?? '',
      date: post.publishedAt.toISOString(),
      updatedAt: contentUpdatedAt(post.publishedAt, revision?.createdAt).toISOString(),
      // 契约约定：详情页 category 展示专栏名（api.md §7.2 示例为"前端开发"）
      category: post.folder,
      tags: post.tags.getItems().map((tag) => ({ label: tag.label, color: tag.color })),
      readTime: `${post.readTimeMinutes} 分钟`,
      views: post.views,
      likes: post.likes,
      comments: post.commentCount,
      // 有 Markdown 原文时前端只渲染原文；目录仍由结构化正文中的标题生成。
      ...(post.contentRaw ? { contentRaw: post.contentRaw } : { content: sections }),
      toc: sections
        .filter((s) => s.type === 'heading' && s.id && s.text)
        .map((s) => ({ id: s.id as string, text: s.text as string, level: s.level ?? 2 })),
    }
  }

  /** 点赞切换在文章行锁内更新，避免不同访客覆盖计数。 */
  async toggleLike(id: number, visitorIdHash: string): Promise<{ liked: boolean; likes: number }> {
    return this.em.transactional(async (em) => {
      const post = await em.findOne(
        Post,
        { id, status: 'published', deletedAt: null },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      )
      if (!post) throw new BusinessException(POST_NOT_FOUND, '文章不存在', HttpStatus.NOT_FOUND)
      const existing = await em.findOne(PostLike, { post, visitorIdHash })
      if (existing) {
        em.remove(existing)
        post.likes = Math.max(0, post.likes - 1)
      } else {
        em.create(PostLike, { post, visitorIdHash, createdAt: new Date() })
        post.likes += 1
      }
      await em.flush()
      return { liked: !existing, likes: post.likes }
    })
  }

  /**
   * 浏览计数按整点小时桶去重，所有增量由行锁串行保护。
   * 同时返回当前访客的点赞状态，文章页挂载后一次请求即可同步互动计数。
   */
  async addView(id: number, visitorIdHash: string): Promise<PostViewResult> {
    return this.em.transactional(async (em) => {
      const post = await em.findOne(
        Post,
        { id, status: 'published', deletedAt: null },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      )
      if (!post) throw new BusinessException(POST_NOT_FOUND, '文章不存在', HttpStatus.NOT_FOUND)
      const hourBucket = new Date()
      hourBucket.setMinutes(0, 0, 0)
      // 事务内共用一条连接，逐条查询，不用 Promise.all。
      const seen = await em.findOne(PostView, { post, visitorIdHash, hourBucket })
      const like = await em.findOne(PostLike, { post, visitorIdHash }, { fields: ['id'] })
      if (!seen) {
        em.create(PostView, { post, visitorIdHash, hourBucket, createdAt: new Date() })
        post.views += 1
        await em.flush()
      }
      return { views: post.views, likes: post.likes, liked: !!like, counted: !seen }
    })
  }

  async interaction(id: number, visitorIdHash: string): Promise<{ liked: boolean; likes: number; views: number }> {
    const post = await this.em.findOne(
      Post,
      { id, status: 'published', deletedAt: null },
      { fields: ['id', 'likes', 'views'] },
    )
    if (!post) throw new BusinessException(POST_NOT_FOUND, '文章不存在', HttpStatus.NOT_FOUND)
    const like = visitorIdHash ? await this.em.findOne(PostLike, { post, visitorIdHash }) : null
    return { liked: !!like, likes: post.likes, views: post.views }
  }

  async findBySlug(slug: string): Promise<ArticleDetailDto> {
    const address = await this.em.findOne(PostAddress, { slug, post: { status: 'published', deletedAt: null } })
    if (!address) throw new BusinessException(POST_NOT_FOUND, '文章不存在', HttpStatus.NOT_FOUND)
    return this.findDetail(address.post.id)
  }
  private toPostItem(post: PostListSource): PostItemDto {
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
}
