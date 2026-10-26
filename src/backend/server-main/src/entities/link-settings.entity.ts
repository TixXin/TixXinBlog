/** @file link-settings.entity.ts @description 独立友链规则配置与公开申请开关，开关默认关闭，已部署站点不改变现状 */
import { Entity, PrimaryKey, Property } from '@mikro-orm/core'
@Entity({ tableName: 'link_settings' })
export class LinkSettings {
  @PrimaryKey({ type: 'text' }) id!: string
  @Property({ type: 'integer', default: 0 }) revision: number = 0
  @Property({ type: 'json', defaultRaw: "'[]'::jsonb" }) rules: string[] = []
  @Property({ type: 'boolean', default: false }) applicationsEnabled: boolean = false
  @Property({ type: 'datetime' }) updatedAt: Date = new Date()
}
