/** @file link-settings.entity.ts @description 独立友链规则配置，不虚构在线申请或审核服务 */
import { Entity, PrimaryKey, Property } from '@mikro-orm/core'
@Entity({ tableName: 'link_settings' })
export class LinkSettings {
  @PrimaryKey({ type: 'text' }) id!: string
  @Property({ type: 'integer', default: 0 }) revision: number = 0
  @Property({ type: 'json', defaultRaw: "'[]'::jsonb" }) rules: string[] = []
  @Property({ type: 'datetime' }) updatedAt: Date = new Date()
}
