/**
 * @file post-revision.entity.ts
 * @description 文章内容修订快照，不回滚评论、阅读及点赞计数。
 */
import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core'
import { Post } from './post.entity'
import type { PostCategory, PostContentSection, PostStatus } from './post.entity'
import type { ContentRelation } from '../common/types/content-relation'

export interface PostSnapshot {
  relatedContent?: ContentRelation[]
  slug?: string
  coverAlt?: string
  seoTitle?: string
  seoDescription?: string
  seoNoindex?: boolean
  title: string
  summary: string
  cover: string
  folder: string
  category: PostCategory
  contentRaw: string
  contentSections?: PostContentSection[]
  readTimeMinutes: number
  status: PostStatus
  pinned: boolean
  tags: string[]
}

@Entity({ tableName: 'post_revision' })
@Unique({ properties: ['post', 'revision'] })
export class PostRevision {
  @PrimaryKey({ type: 'integer', autoincrement: true }) id!: number
  @ManyToOne({ entity: () => Post, deleteRule: 'cascade' }) post!: Post
  @Property({ type: 'integer' }) revision!: number
  @Property({ type: 'json' }) snapshot!: PostSnapshot
  @Property({ type: 'text' }) reason!: string
  @Property({ type: 'datetime' }) createdAt: Date = new Date()
}
