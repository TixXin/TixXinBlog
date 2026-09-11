/** @file gallery-photo.entity.ts @description 图库作品独立于媒体文件；拍摄日期缺省保留，删除保留提交去重依据 */
import { Check, Entity, Index, ManyToOne, OptionalProps, PrimaryKey, Property, Unique } from '@mikro-orm/core'
import { MediaAsset } from './media-asset.entity'
import type { ContentRelation } from '../common/types/content-relation'

export const GALLERY_STATUSES = ['draft', 'published', 'withdrawn'] as const
export type GalleryStatus = (typeof GALLERY_STATUSES)[number]

@Entity({ tableName: 'gallery_photo' })
@Index({ name: 'gallery_visibility_order_idx', properties: ['status', 'deletedAt', 'sortOrder', 'id'] })
@Unique({ properties: ['requestId'] })
@Check({
  name: 'gallery_photo_source_check',
  expression:
    '(media_id is not null and external_url is null) or (media_id is null and external_url is not null and length(external_url) > 0)',
})
export class GalleryPhoto {
  [OptionalProps]?:
    | 'id'
    | 'description'
    | 'category'
    | 'location'
    | 'device'
    | 'status'
    | 'sortOrder'
    | 'revision'
    | 'createdAt'
    | 'updatedAt'
    | 'relatedContent'
  @Property({ type: 'json', defaultRaw: "'[]'::jsonb" }) relatedContent: ContentRelation[] = []
  @PrimaryKey({ type: 'integer', autoincrement: true }) id!: number
  @ManyToOne({ entity: () => MediaAsset, deleteRule: 'restrict', nullable: true }) media?: MediaAsset | null
  @Property({ type: 'text', nullable: true }) externalUrl?: string | null
  @Property({ type: 'text' }) title!: string
  @Property({ type: 'text', default: '' }) description: string = ''
  @Property({ type: 'text', default: '' }) category: string = ''
  @Property({ type: 'date', nullable: true }) takenOn?: string | null
  @Property({ type: 'text', default: '' }) location: string = ''
  @Property({ type: 'text', default: '' }) device: string = ''
  @Property({ type: 'text', default: 'draft' }) status: GalleryStatus = 'draft'
  @Property({ type: 'integer', default: 0 }) sortOrder: number = 0
  @Property({ type: 'integer', default: 0 }) revision: number = 0
  @Property({ type: 'text', nullable: true }) requestId?: string
  @Property({ type: 'text', nullable: true }) requestHash?: string
  @Property({ type: 'datetime', nullable: true }) publishedAt?: Date | null
  @Property({ type: 'datetime', nullable: true }) deletedAt?: Date | null
  @Property({ type: 'datetime' }) createdAt: Date = new Date()
  @Property({ type: 'datetime', onUpdate: () => new Date() }) updatedAt: Date = new Date()
}
