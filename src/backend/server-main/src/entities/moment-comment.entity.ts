/** @file moment-comment.entity.ts @description 朋友圈评论、审核状态和提交去重，访客原始标识不入库 */
import { Entity, Index, ManyToOne, OptionalProps, PrimaryKey, Property, Unique } from '@mikro-orm/core'
import { randomUUID } from 'node:crypto'
import { Moment } from './moment.entity'

export const MOMENT_COMMENT_STATUSES = ['published', 'pending', 'hidden'] as const
export type MomentCommentStatus = (typeof MOMENT_COMMENT_STATUSES)[number]

@Entity({ tableName: 'moment_comment' })
@Unique({ properties: ['moment', 'visitorIdHash', 'requestId'] })
@Index({ properties: ['moment', 'status', 'createdAt', 'id'] })
export class MomentComment {
  [OptionalProps]?: 'id' | 'isOwner' | 'status' | 'createdAt'
  @PrimaryKey({ type: 'text' }) id: string = randomUUID()
  @ManyToOne({ entity: () => Moment, deleteRule: 'cascade' }) moment!: Moment
  @Property({ type: 'text' }) visitorIdHash!: string
  @Property({ type: 'text' }) author!: string
  @Property({ type: 'text' }) avatar!: string
  @Property({ type: 'text' }) content!: string
  @Property({ type: 'boolean', default: false }) isOwner: boolean = false
  @Property({ type: 'text', default: 'published' }) status: MomentCommentStatus = 'published'
  @Property({ type: 'text', nullable: true }) requestId?: string
  @Property({ type: 'text', nullable: true }) requestHash?: string
  @Property({ type: 'datetime', nullable: true }) deletedAt?: Date | null
  @Property({ type: 'datetime' }) createdAt: Date = new Date()
}
