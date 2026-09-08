/**
 * @file post-address.entity.ts
 * @description 自定义地址及历史地址映射，旧地址继续指向同一文章。
 */
import { Entity, ManyToOne, PrimaryKey } from '@mikro-orm/core'
import { Post } from './post.entity'
@Entity({ tableName: 'post_address' })
export class PostAddress {
  @PrimaryKey({ type: 'text' }) slug!: string
  @ManyToOne({ entity: () => Post, deleteRule: 'cascade' }) post!: Post
}
