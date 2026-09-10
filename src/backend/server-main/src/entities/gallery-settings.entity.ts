/** @file gallery-settings.entity.ts @description 图库器材介绍的明确配置来源；与公开作品统计分开维护 */
import { Entity, PrimaryKey, Property } from '@mikro-orm/core'
export const GALLERY_GEAR_ICONS = ['lucide:camera', 'lucide:circle', 'lucide:smartphone'] as const
export interface GalleryGear {
  icon: (typeof GALLERY_GEAR_ICONS)[number]
  name: string
  description: string
}
@Entity({ tableName: 'gallery_settings' })
export class GallerySettings {
  @PrimaryKey({ type: 'text' }) id!: string
  @Property({ type: 'integer', default: 0 }) revision: number = 0
  @Property({ type: 'json', defaultRaw: "'[]'::jsonb" }) gear: GalleryGear[] = []
  @Property({ type: 'datetime' }) updatedAt: Date = new Date()
}
