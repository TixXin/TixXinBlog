/**
 * @file flash-comment.entity.ts
 * @description 闪念评论实体,authorId 存访客哈希(或博主标识),展示信息冗余快照;status 与文章/朋友圈评论同一取值,公开读取只计已发布
 * @author TixXin
 * @since 2026-07-20
 */

import { Entity, Index, ManyToOne, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core'
import { randomUUID } from 'node:crypto'
// 与 FlashNote 互相引用属预期:双向关系经 () => 惰性解析
import { FlashNote } from './flash-note.entity'

/** 审核状态与朋友圈评论一致:published 公开、pending 待审(仅提交者本机可见)、hidden 隐藏 */
export const FLASH_COMMENT_STATUSES = ['published', 'pending', 'hidden'] as const
export type FlashCommentStatus = (typeof FLASH_COMMENT_STATUSES)[number]

@Entity({ tableName: 'flash_comment' })
@Index({ properties: ['flashNote', 'status', 'createdAt'] })
export class FlashComment {
  [OptionalProps]?: 'id' | 'status' | 'createdAt'

  @PrimaryKey({ type: 'text' })
  id: string = randomUUID()

  @ManyToOne({ entity: () => FlashNote, deleteRule: 'cascade' })
  @Index()
  flashNote!: FlashNote

  /** 访客 id 的 SHA-256 哈希,不存原文(api.md §5.1) */
  @Property({ type: 'text' })
  authorId!: string

  @Property({ type: 'text' })
  authorName!: string

  @Property({ type: 'text' })
  authorAvatar!: string

  @Property({ type: 'text' })
  content!: string

  /** 存量与旧内容包导入按已发布处理;访客新评论按评论策略决定是否先审 */
  @Property({ type: 'text', default: 'published' })
  status: FlashCommentStatus = 'published'

  @Property({ type: 'datetime' })
  createdAt: Date = new Date()
}
