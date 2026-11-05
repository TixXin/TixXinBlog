/** @file moment-reaction.entity.ts @description 朋友圈表情回应：每个访客对一条动态的同种回应最多一条，计数来自实际记录；点赞另有 moment_like */
import { Entity, Index, ManyToOne, OptionalProps, PrimaryKey, Property, Unique } from '@mikro-orm/core'
import { Moment } from './moment.entity'

/** 与留言回应同一组图标，去掉与点赞重复的 👍 和偏留言语境的 📷 */
export const MOMENT_REACTIONS = ['❤️', '🎉', '🔥', '😄', '🙏', '💡'] as const
export type MomentReactionKind = (typeof MOMENT_REACTIONS)[number]

@Entity({ tableName: 'moment_reaction' })
@Unique({ name: 'moment_reaction_unique', properties: ['moment', 'visitorIdHash', 'emoji'] })
@Index({ properties: ['moment', 'emoji'] })
export class MomentReaction {
  [OptionalProps]?: 'createdAt'
  @PrimaryKey({ type: 'integer', autoincrement: true }) id!: number
  @ManyToOne({ entity: () => Moment, deleteRule: 'cascade' }) moment!: Moment
  @Property({ type: 'text' }) visitorIdHash!: string
  @Property({ type: 'text' }) emoji!: MomentReactionKind
  @Property({ type: 'datetime' }) createdAt: Date = new Date()
}
