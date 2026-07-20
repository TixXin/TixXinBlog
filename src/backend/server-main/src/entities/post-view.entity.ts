/**
 * @file post-view.entity.ts
 * @description 文章浏览记录，(post, visitorIdHash, hourBucket) 联合唯一实现 1 小时去重
 * @author TixXin
 * @since 2026-07-20
 */

import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core'
import { Post } from './post.entity'

@Entity({ tableName: 'post_view' })
@Unique({ properties: ['post', 'visitorIdHash', 'hourBucket'] })
export class PostView {
  @PrimaryKey({ type: 'integer', autoincrement: true })
  id!: number

  @ManyToOne({ entity: () => Post, deleteRule: 'cascade' })
  post!: Post

  @Property({ type: 'text' })
  visitorIdHash!: string

  /** 整点时间桶：date_trunc('hour') 语义，应用层归一化后写入 */
  @Property({ type: 'datetime' })
  hourBucket!: Date

  @Property({ type: 'datetime' })
  createdAt: Date = new Date()
}
