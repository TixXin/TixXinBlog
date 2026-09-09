/** @file moment-like.entity.ts @description 每个访客对动态最多一条点赞记录，显式目标状态支持重复请求 */
import { Entity, ManyToOne, OptionalProps, PrimaryKey, Property, Unique } from '@mikro-orm/core'
import { Moment } from './moment.entity'

@Entity({ tableName: 'moment_like' })
@Unique({ properties: ['moment', 'visitorIdHash'] })
export class MomentLike {
  [OptionalProps]?: 'createdAt'
  @PrimaryKey({ type: 'integer', autoincrement: true }) id!: number
  @ManyToOne({ entity: () => Moment, deleteRule: 'cascade' }) moment!: Moment
  @Property({ type: 'text' }) visitorIdHash!: string
  @Property({ type: 'datetime' }) createdAt: Date = new Date()
}
