/**
 * @file post.entity.ts
 * @description 文章实体，字段映射前端 PostItem 与 ArticleDetail
 * @author TixXin
 * @since 2026-07-20
 *
 * 与 docs/backend/development.md §4.1 的偏离：主键采用自增整数而非 uuid v7。
 * 原因：前端契约 PostItem.id 为 number（api.md §7.2 列表示例同为数字），
 * uuid 迁移需待前端统一 id 类型后再做。
 */

import { Collection, Entity, Enum, Index, ManyToMany, PrimaryKey, Property } from '@mikro-orm/core'
import { PostTag } from './post-tag.entity'

/** 文章正文块，镜像前端 features/post/types.ts 的 ArticleSection */
export interface PostContentSection {
  type: 'heading' | 'paragraph' | 'code' | 'quote' | 'list'
  level?: number
  text?: string
  language?: string
  items?: string[]
  id?: string
}

export const POST_CATEGORIES = ['tech', 'life'] as const
export type PostCategory = (typeof POST_CATEGORIES)[number]

export const POST_STATUSES = ['draft', 'published', 'archived'] as const
export type PostStatus = (typeof POST_STATUSES)[number]

@Entity({ tableName: 'post' })
export class Post {
  @PrimaryKey({ type: 'integer', autoincrement: true })
  id!: number

  @Property({ type: 'text' })
  title!: string

  /** SEO slug，中文标题暂不强制生成，后台完善后启用 */
  @Property({ type: 'text', nullable: true })
  @Index()
  slug?: string

  @Property({ type: 'text' })
  summary!: string

  @Property({ type: 'text', nullable: true })
  cover?: string

  @Enum({ items: () => POST_CATEGORIES, nativeEnumName: 'post_category' })
  category!: PostCategory

  /** 专栏名（前端 PostItem.folder，详情页 category 字段也取此值） */
  @Property({ type: 'text' })
  folder!: string

  @Property({ type: 'integer' })
  readTimeMinutes!: number

  /** Markdown 原文，mock 迁移期可空 */
  @Property({ type: 'text', nullable: true })
  contentRaw?: string

  /** 解析后的正文块缓存（JSONB），直接喂给前端 ArticleContent */
  @Property({ type: 'json', nullable: true })
  contentSections?: PostContentSection[]

  @Property({ type: 'boolean', default: false })
  pinned: boolean = false

  @Enum({ items: () => POST_STATUSES, nativeEnumName: 'post_status' })
  @Index()
  status: PostStatus = 'published'

  @Property({ type: 'datetime' })
  @Index()
  publishedAt!: Date

  @Property({ type: 'integer', default: 0 })
  views: number = 0

  @Property({ type: 'integer', default: 0 })
  likes: number = 0

  @Property({ type: 'integer', default: 0 })
  commentCount: number = 0

  @ManyToMany({ entity: () => PostTag, pivotTable: 'post_tag_map' })
  tags = new Collection<PostTag>(this)

  @Property({ type: 'datetime' })
  createdAt: Date = new Date()

  @Property({ type: 'datetime', onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
