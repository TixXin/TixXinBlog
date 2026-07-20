/**
 * @file comment-like.entity.ts
 * @description 评论点赞记录,(comment, visitorIdHash) 联合唯一实现切换
 * @author TixXin
 * @since 2026-07-20
 */

import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core'
import { Comment } from './comment.entity'

@Entity({ tableName: 'comment_like' })
@Unique({ properties: ['comment', 'visitorIdHash'] })
export class CommentLike {
  @PrimaryKey({ type: 'integer', autoincrement: true })
  id!: number

  @ManyToOne({ entity: () => Comment, deleteRule: 'cascade' })
  comment!: Comment

  @Property({ type: 'text' })
  visitorIdHash!: string

  @Property({ type: 'datetime' })
  createdAt: Date = new Date()
}
