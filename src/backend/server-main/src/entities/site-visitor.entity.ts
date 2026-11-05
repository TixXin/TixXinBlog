/**
 * @file site-visitor.entity.ts
 * @description 看过本站的匿名访客：只存访客 ID 的 SHA-256 哈希与日期，不存 IP、User-Agent 或访问路径。
 *   lastSeenDay 为站点时区下的日期，用于判断当天是否已计入每日访客数。
 */
import { Entity, PrimaryKey, Property } from '@mikro-orm/core'

@Entity({ tableName: 'site_visitor' })
export class SiteVisitor {
  @PrimaryKey({ type: 'text' }) visitorHash!: string
  @Property({ type: 'datetime' }) firstSeenAt: Date = new Date()
  @Property({ type: 'date' }) lastSeenDay!: string
}
