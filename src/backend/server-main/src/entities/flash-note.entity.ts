/**
 * @file flash-note.entity.ts
 * @description 闪念笔记实体,字段对齐前端 features/flash/types.ts 的 FlashNote
 * @author TixXin
 * @since 2026-07-20
 *
 * 主键为 text:前端契约 FlashNote.id 是 string,且 seed 数据带稳定 id
 * (flash-seed-xx,保证 RSS 与详情页链接不因重灌种子而漂移)。
 */

import { Collection, Entity, Enum, Index, OneToMany, PrimaryKey, Property } from '@mikro-orm/core'
import { randomUUID } from 'node:crypto'
// 与 FlashComment 互相引用属预期:MikroORM 双向关系经 () => 惰性解析,无初始化顺序问题
import { FlashComment } from './flash-comment.entity'

export const FLASH_TYPES = ['idea', 'todo', 'memo'] as const
export type FlashType = (typeof FLASH_TYPES)[number]

@Entity({ tableName: 'flash_note' })
export class FlashNote {
  @PrimaryKey({ type: 'text' })
  id: string = randomUUID()

  /** 所属用户,当前单博主场景固定 'tixxin' */
  @Property({ type: 'text' })
  @Index()
  userId!: string

  @Property({ type: 'text' })
  content!: string

  @Property({ type: 'json' })
  tags: string[] = []

  /** 图片 URL 列表(最多 9 张) */
  @Property({ type: 'json' })
  images: string[] = []

  @Enum({ items: () => FLASH_TYPES, nativeEnumName: 'flash_type' })
  type: FlashType = 'memo'

  @Property({ type: 'integer', default: 0 })
  likes: number = 0

  @Property({ type: 'boolean', default: false })
  isPinned: boolean = false

  @Property({ type: 'boolean', default: false })
  @Index()
  isArchived: boolean = false

  @Property({ type: 'boolean', default: false })
  isDraft: boolean = false

  @OneToMany({ entity: () => FlashComment, mappedBy: 'flashNote' })
  comments = new Collection<FlashComment>(this)

  @Property({ type: 'datetime' })
  @Index()
  createdAt: Date = new Date()

  @Property({ type: 'datetime', onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
