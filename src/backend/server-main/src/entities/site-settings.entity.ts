/**
 * @file site-settings.entity.ts
 * @description 单站点运行时公开资料与版本化历史，不包含部署密钥或内部连接地址。
 */
import { Entity, PrimaryKey, Property } from '@mikro-orm/core'
import type { AboutSettingsDto } from '../modules/site/about-settings'
import type { SiteExtrasValues } from '../modules/site/site-navigation'
/** 导航、页脚链接、每日一言、备案号与版权文案为后加 JSON 键，旧记录缺失时读取按缺省值补齐 */
export interface SiteSettingsValues extends Partial<SiteExtrasValues> {
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
  /** 博主当前状态短语（如“摆烂中”），空串表示不展示在线状态 */
  presenceLabel?: string
  /** 状态签名（如“今天不想写代码”） */
  presenceSignature?: string
  /** 站点上线日期 YYYY-MM-DD，用于“已运行 N 天”；空串按最早发布文章推算 */
  launchedAt?: string
  /** 在线状态类型：空串表示有状态文案时按“在线”展示；idle 为离开，busy 为忙碌 */
  presenceStatus?: '' | 'online' | 'idle' | 'busy'
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
