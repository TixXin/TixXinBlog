/** @file guestbook-message.entity.ts @description 独立留言及回复引用；公开状态与发送结果分离，删除保留提交去重记录 */
import { Entity, Index, ManyToOne, OptionalProps, PrimaryKey, Property, Unique } from '@mikro-orm/core'

export const GUESTBOOK_STATUSES = ['published', 'pending', 'hidden'] as const
export type GuestbookStatus = (typeof GUESTBOOK_STATUSES)[number]
@Entity({ tableName: 'guestbook_message' })
@Unique({ name: 'guestbook_submission_unique', properties: ['visitorIdHash', 'requestId'] })
@Index({ name: 'guestbook_visibility_order_idx', properties: ['status', 'deletedAt', 'createdAt', 'id'] })
@Index({
  name: 'guestbook_single_pinned',
  expression: `create unique index "guestbook_single_pinned" on "guestbook_message" ("is_pinned") where "is_pinned" = true and "status" = 'published' and "deleted_at" is null`,
})
export class GuestbookMessage {
  [OptionalProps]?: 'status' | 'revision' | 'isOwner' | 'isPinned' | 'createdAt' | 'updatedAt'
  @PrimaryKey({ type: 'integer', autoincrement: true }) id!: number
  @Property({ type: 'text' }) visitorIdHash!: string
  @Property({ type: 'text' }) author!: string
  @Property({ type: 'text' }) avatar!: string
  @Property({ type: 'text' }) content!: string
  @ManyToOne({ entity: () => GuestbookMessage, nullable: true, deleteRule: 'set null' })
  @Index({ name: 'guestbook_reply_idx' })
  replyTo?: GuestbookMessage | null
  @Property({ type: 'text', default: 'published' }) status: GuestbookStatus = 'published'
  @Property({ type: 'integer', default: 0 }) revision: number = 0
  @Property({ type: 'boolean', default: false }) isOwner: boolean = false
  @Property({ type: 'boolean', default: false }) isPinned: boolean = false
  @Property({ type: 'text', nullable: true }) requestId?: string
  @Property({ type: 'text', nullable: true }) requestHash?: string
  @Property({ type: 'datetime', nullable: true }) deletedAt?: Date | null
  @Property({ type: 'datetime' }) createdAt: Date = new Date()
  @Property({ type: 'datetime', onUpdate: () => new Date() }) updatedAt: Date = new Date()
}
