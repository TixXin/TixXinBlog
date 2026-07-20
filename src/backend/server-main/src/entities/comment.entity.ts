/**
 * @file comment.entity.ts
 * @description 文章评论实体（树形,最深 3 层）,作者信息以快照 JSONB 存储
 * @author TixXin
 * @since 2026-07-20
 */

import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'
import { Post } from './post.entity'

/** 评论作者快照：访客无账号体系,冗余存展示信息 + 访客哈希（development.md §4.1） */
export interface CommentAuthorSnapshot {
  name: string
  avatar: string
  visitorIdHash?: string
}

/** 评论最大层级：根=0、回复=1、回复的回复=2；再深拒绝（api.md 错误码 1003） */
export const COMMENT_MAX_DEPTH = 2

@Entity({ tableName: 'comment' })
export class Comment {
  @PrimaryKey({ type: 'integer', autoincrement: true })
  id!: number

  @ManyToOne({ entity: () => Post, deleteRule: 'cascade' })
  @Index()
  post!: Post

  @ManyToOne({ entity: () => Comment, nullable: true, deleteRule: 'cascade' })
  parent?: Comment

  /** 冗余层级,写入时由 parent.depth + 1 计算,免递归查询 */
  @Property({ type: 'integer', default: 0 })
  depth: number = 0

  @Property({ type: 'json' })
  authorSnapshot!: CommentAuthorSnapshot

  @Property({ type: 'text' })
  content!: string

  @Property({ type: 'integer', default: 0 })
  likes: number = 0

  /** 是否博主本人发言（管理员后台回复时置 true） */
  @Property({ type: 'boolean', default: false })
  isOwner: boolean = false

  @Property({ type: 'datetime' })
  createdAt: Date = new Date()
}
