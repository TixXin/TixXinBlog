/** @file moment.entity.ts @description 朋友圈动态；与闪念独立，删除保留提交标识以防迟到重试重新创建 */
import { Entity, Index, ManyToOne, OptionalProps, PrimaryKey, Property, Unique } from '@mikro-orm/core'
import { randomUUID } from 'node:crypto'
import { Post } from './post.entity'

export const MOMENT_STATUSES = ['draft', 'published', 'archived'] as const
export type MomentStatus = (typeof MOMENT_STATUSES)[number]
export interface MomentLink {
  url: string
  title: string
  description?: string
  image?: string
  siteName?: string
  favicon?: string
}

@Entity({ tableName: 'moment' })
@Index({ properties: ['status', 'deletedAt', 'isPinned', 'publishedAt', 'id'] })
@Unique({ properties: ['requestId'] })
export class Moment {
  [OptionalProps]?:
    'id' | 'topics' | 'images' | 'status' | 'revision' | 'isPinned' | 'likes' | 'createdAt' | 'updatedAt'
  @PrimaryKey({ type: 'text' }) id: string = randomUUID()
  @Property({ type: 'text' }) content!: string
  @Property({ type: 'json', defaultRaw: "'[]'::jsonb" }) topics: string[] = []
  @Property({ type: 'json', defaultRaw: "'[]'::jsonb" }) images: string[] = []
  @Property({ type: 'text', nullable: true }) location?: string | null
  @Property({ type: 'text', nullable: true }) device?: string | null
  @Property({ type: 'text', nullable: true }) mood?: string | null
  @ManyToOne({ entity: () => Post, nullable: true, deleteRule: 'set null' }) linkedArticle?: Post | null
  @Property({ type: 'json', nullable: true }) linkedLink?: MomentLink | null
  @Property({ type: 'text', default: 'draft' }) status: MomentStatus = 'draft'
  @Property({ type: 'integer', default: 0 }) revision: number = 0
  @Property({ type: 'boolean', default: false }) isPinned: boolean = false
  @Property({ type: 'integer', default: 0 }) likes: number = 0
  @Property({ type: 'text', nullable: true }) requestId?: string
  @Property({ type: 'text', nullable: true }) requestHash?: string
  @Property({ type: 'datetime', nullable: true }) publishedAt?: Date | null
  @Property({ type: 'datetime', nullable: true }) deletedAt?: Date | null
  @Property({ type: 'datetime' }) createdAt: Date = new Date()
  @Property({ type: 'datetime', onUpdate: () => new Date() }) updatedAt: Date = new Date()
}
