/** @file friend-link.entity.ts @description 博主管理的友链，推荐与发布独立，头像复用媒体或明确外部地址 */
import { Entity, Index, ManyToOne, OptionalProps, PrimaryKey, Property, Unique } from '@mikro-orm/core'
import { MediaAsset } from './media-asset.entity'
export const LINK_STATUSES = ['draft', 'published', 'withdrawn'] as const
export type LinkStatus = (typeof LINK_STATUSES)[number]
@Entity({ tableName: 'friend_link' })
@Index({
  name: 'friend_link_visibility_order_idx',
  properties: ['status', 'deletedAt', 'isFeatured', 'sortOrder', 'id'],
})
@Index({
  name: 'friend_link_public_url_unique',
  expression: `create unique index "friend_link_public_url_unique" on "friend_link" ("url") where "status" = 'published' and "deleted_at" is null`,
})
@Unique({ properties: ['requestId'] })
export class FriendLink {
  [OptionalProps]?:
    'id' | 'description' | 'status' | 'isFeatured' | 'sortOrder' | 'revision' | 'createdAt' | 'updatedAt'
  @PrimaryKey({ type: 'integer', autoincrement: true }) id!: number
  @Property({ type: 'text' }) name!: string
  @Property({ type: 'text', default: '' }) description: string = ''
  @Property({ type: 'text' }) url!: string
  @ManyToOne({ entity: () => MediaAsset, nullable: true, deleteRule: 'restrict' }) logoMedia?: MediaAsset | null
  @Property({ type: 'text', nullable: true }) logoUrl?: string | null
  @Property({ type: 'text', default: 'draft' }) status: LinkStatus = 'draft'
  @Property({ type: 'boolean', default: false }) isFeatured: boolean = false
  @Property({ type: 'integer', default: 0 }) sortOrder: number = 0
  @Property({ type: 'integer', default: 0 }) revision: number = 0
  @Property({ type: 'text', nullable: true }) requestId?: string
  @Property({ type: 'text', nullable: true }) requestHash?: string
  @Property({ type: 'datetime', nullable: true }) publishedAt?: Date | null
  @Property({ type: 'datetime', nullable: true }) deletedAt?: Date | null
  @Property({ type: 'datetime' }) createdAt: Date = new Date()
  @Property({ type: 'datetime', onUpdate: () => new Date() }) updatedAt: Date = new Date()
}
