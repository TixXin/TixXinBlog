/**
 * @file flash-comment.entity.ts
 * @description 闪念评论实体,authorId 存访客哈希(或博主标识),展示信息冗余快照
 * @author TixXin
 * @since 2026-07-20
 */

import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'
import { randomUUID } from 'node:crypto'
// 与 FlashNote 互相引用属预期:双向关系经 () => 惰性解析
import { FlashNote } from './flash-note.entity'

@Entity({ tableName: 'flash_comment' })
export class FlashComment {
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

  @Property({ type: 'datetime' })
  createdAt: Date = new Date()
}
