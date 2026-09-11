/** @file owner-notification.entity.ts @description 博主站内通知独立记录已读，不保存私密正文或把已读等同处理 */
import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/core'
export type OwnerEventKind = 'guestbook' | 'comment' | 'moment-comment' | 'task'
@Entity({ tableName: 'owner_notification' })
@Index({ name: 'owner_notification_unread_index', properties: ['readAt', 'createdAt'] })
export class OwnerNotification {
  @PrimaryKey({ type: 'uuid' }) id!: string
  @Property({ type: 'text' }) @Unique() eventKey!: string
  @Property({ type: 'text' }) kind!: OwnerEventKind
  @Property({ type: 'text' }) sourceId!: string
  @Property({ type: 'text' }) reason!: string
  @Property({ type: 'datetime', nullable: true }) readAt?: Date
  @Property({ type: 'datetime' }) createdAt = new Date()
}
