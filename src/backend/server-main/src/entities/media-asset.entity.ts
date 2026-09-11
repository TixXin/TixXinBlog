/**
 * @file media-asset.entity.ts
 * @description 媒体元信息与可恢复删除状态，文件内容通过存储接口管理。
 */
import { Entity, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core'
import { randomUUID } from 'node:crypto'
@Entity({ tableName: 'media_asset' })
export class MediaAsset {
  [OptionalProps]?: 'id' | 'alt' | 'description' | 'createdAt'
  @PrimaryKey({ type: 'uuid' }) id: string = randomUUID()
  @Property({ type: 'text' }) originalName!: string
  @Property({ type: 'text' }) storageKey!: string
  @Property({ type: 'text' }) mimeType!: string
  @Property({ type: 'integer' }) byteSize!: number
  @Property({ type: 'integer' }) width!: number
  @Property({ type: 'integer' }) height!: number
  @Property({ type: 'text' }) sha256!: string
  @Property({ type: 'text', default: '' }) alt: string = ''
  @Property({ type: 'text', default: '' }) description: string = ''
  @Property({ type: 'datetime' }) createdAt: Date = new Date()
  @Property({ type: 'datetime', nullable: true }) deletedAt?: Date
}
