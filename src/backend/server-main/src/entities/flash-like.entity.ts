/**
 * @file flash-like.entity.ts
 * @description 闪念点赞记录,(flashNote, visitorIdHash) 联合唯一实现切换
 * @author TixXin
 * @since 2026-07-20
 */

import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core'
import { FlashNote } from './flash-note.entity'

@Entity({ tableName: 'flash_like' })
@Unique({ properties: ['flashNote', 'visitorIdHash'] })
export class FlashLike {
  @PrimaryKey({ type: 'integer', autoincrement: true })
  id!: number

  @ManyToOne({ entity: () => FlashNote, deleteRule: 'cascade' })
  flashNote!: FlashNote

  @Property({ type: 'text' })
  visitorIdHash!: string

  @Property({ type: 'datetime' })
  createdAt: Date = new Date()
}
