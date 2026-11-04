/**
 * @file post-view.entity.ts
 * @description 文章浏览记录：同一访客对同一文章 30 分钟内只计一次，由服务层在文章行锁内按 (post, visitorIdHash, createdAt) 索引查询
 * @author TixXin
 * @since 2026-07-20
 */

import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'
import { Post } from './post.entity'

@Entity({ tableName: 'post_view' })
@Index({ properties: ['post', 'visitorIdHash', 'createdAt'] })
export class PostView {
  @PrimaryKey({ type: 'integer', autoincrement: true })
  id!: number

  @ManyToOne({ entity: () => Post, deleteRule: 'cascade' })
  post!: Post

  @Property({ type: 'text' })
  visitorIdHash!: string

  @Property({ type: 'datetime' })
  createdAt: Date = new Date()
}
