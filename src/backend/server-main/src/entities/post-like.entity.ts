/**
 * @file post-like.entity.ts
 * @description 文章点赞记录，(post, visitorIdHash) 联合唯一实现点赞切换
 * @author TixXin
 * @since 2026-07-20
 */

import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core'
import { Post } from './post.entity'

@Entity({ tableName: 'post_like' })
@Unique({ properties: ['post', 'visitorIdHash'] })
export class PostLike {
  @PrimaryKey({ type: 'integer', autoincrement: true })
  id!: number

  @ManyToOne({ entity: () => Post, deleteRule: 'cascade' })
  post!: Post

  /** 访客 id 的 SHA-256 哈希，不保存原文（api.md §5.1） */
  @Property({ type: 'text' })
  visitorIdHash!: string

  @Property({ type: 'datetime' })
  createdAt: Date = new Date()
}
