/**
 * @file site-settings.entity.ts
 * @description 单站点运行时公开资料与版本化历史，不包含部署密钥或内部连接地址。
 */
import { Entity, PrimaryKey, Property } from '@mikro-orm/core'
import type { AboutSettingsDto } from '../modules/site/about-settings'
export interface SiteSettingsValues {
  about?: AboutSettingsDto
  name: string
  description: string
  ownerName: string
  ownerTitle: string
  avatar: string
  avatarAlt: string
  seoTitle: string
  seoDescription: string
  announcement: string
  announcementUpdatedAt: string
  socials: { label: string; href: string; icon: string }[]
}
@Entity({ tableName: 'site_settings' })
export class SiteSettings {
  @PrimaryKey({ type: 'text' }) id!: string
  @Property({ type: 'integer', default: 0 }) revision: number = 0
  @Property({ type: 'json' }) values!: SiteSettingsValues
  @Property({ type: 'datetime' }) updatedAt: Date = new Date()
}
@Entity({ tableName: 'site_settings_revision' })
export class SiteSettingsRevision {
  @PrimaryKey({ type: 'integer', autoincrement: false }) revision!: number
  @Property({ type: 'json' }) values!: SiteSettingsValues
  @Property({ type: 'text' }) reason!: string
  @Property({ type: 'datetime' }) createdAt: Date = new Date()
}
