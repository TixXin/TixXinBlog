/** @file guestbook-reaction.entity.ts @description 每个访客对一条留言的同种回应最多一条，计数来自实际记录 */
import { Entity, ManyToOne, OptionalProps, PrimaryKey, Property, Unique } from '@mikro-orm/core'
import { GuestbookMessage } from './guestbook-message.entity'

export const GUESTBOOK_REACTIONS = ['👍', '❤️', '🎉', '🔥', '😄', '🙏', '📷', '💡'] as const
export type GuestbookReactionKind = (typeof GUESTBOOK_REACTIONS)[number]
@Entity({ tableName: 'guestbook_reaction' })
@Unique({ name: 'guestbook_reaction_unique', properties: ['message', 'visitorIdHash', 'emoji'] })
export class GuestbookReaction {
  [OptionalProps]?: 'createdAt'
  @PrimaryKey({ type: 'integer', autoincrement: true }) id!: number
  @ManyToOne({ entity: () => GuestbookMessage, deleteRule: 'cascade' }) message!: GuestbookMessage
  @Property({ type: 'text' }) visitorIdHash!: string
  @Property({ type: 'text' }) emoji!: GuestbookReactionKind
  @Property({ type: 'datetime' }) createdAt: Date = new Date()
}
