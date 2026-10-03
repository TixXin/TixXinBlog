/** @file image-prompt.entity.ts @description 图片提示词分享，保留生成配方与图片来源，草稿仅博主可见 */
import { Check, Entity, Enum, Index, ManyToOne, OptionalProps, PrimaryKey, Property, Unique } from '@mikro-orm/core'
import { MediaAsset } from './media-asset.entity'

export const IMAGE_PROMPT_STATUSES = ['draft', 'published'] as const
export type ImagePromptStatus = (typeof IMAGE_PROMPT_STATUSES)[number]

@Entity({ tableName: 'image_prompt' })
@Index({ name: 'image_prompt_visibility_order_idx', properties: ['status', 'id'] })
@Unique({ properties: ['requestId'] })
@Check({
  name: 'image_prompt_source_check',
  expression:
    '(media_id is not null and external_image_url is null) or (media_id is null and external_image_url is not null and length(external_image_url) > 0)',
})
export class ImagePrompt {
  [OptionalProps]?:
    | 'id'
    | 'description'
    | 'negativePrompt'
    | 'model'
    | 'tags'
    | 'imageAlt'
    | 'sourceUrl'
    | 'status'
    | 'revision'
    | 'createdAt'
    | 'updatedAt'
  @PrimaryKey({ type: 'integer', autoincrement: true }) id!: number
  @Property({ type: 'text' }) title!: string
  @Property({ type: 'text', default: '' }) description: string = ''
  @Property({ type: 'text' }) prompt!: string
  @Property({ type: 'text', default: '' }) negativePrompt: string = ''
  @Property({ type: 'text', default: '' }) model: string = ''
  @Property({ type: 'json', defaultRaw: "'[]'::jsonb" }) tags: string[] = []
  @ManyToOne({ entity: () => MediaAsset, nullable: true, deleteRule: 'restrict' }) media?: MediaAsset | null
  @Property({ type: 'text', nullable: true }) externalImageUrl?: string | null
  @Property({ type: 'text', default: '' }) imageAlt: string = ''
  @Property({ type: 'text', default: '' }) sourceUrl: string = ''
  @Enum({ items: () => IMAGE_PROMPT_STATUSES, default: 'draft' }) status: ImagePromptStatus = 'draft'
  @Property({ type: 'integer', default: 0 }) revision: number = 0
  @Property({ type: 'text', nullable: true }) requestId?: string
  @Property({ type: 'text', nullable: true }) requestHash?: string
  @Property({ type: 'datetime', nullable: true }) publishedAt?: Date | null
  @Property({ type: 'datetime' }) createdAt: Date = new Date()
  @Property({ type: 'datetime', onUpdate: () => new Date() }) updatedAt: Date = new Date()
}
