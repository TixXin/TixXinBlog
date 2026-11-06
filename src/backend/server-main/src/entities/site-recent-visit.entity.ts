/**
 * @file site-recent-visit.entity.ts
 * @description 近期访问明细：默认关闭，博主在后台开启后才记录，只保留 7 天，关闭时立即清空。
 *   只存打码后的 IP（IPv4 留前三段、IPv6 留前三组）、国家代码与省份城市、设备与浏览器大类、页面路径与来源域名，
 *   不存完整 IP、User-Agent 或访客 ID；博主本人的访问不记录。属于运行数据，随完整备份保存，不进内容包。
 */
import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/core'

@Entity({ tableName: 'site_recent_visit' })
@Index({ properties: ['visitedAt'] })
export class SiteRecentVisit {
  @PrimaryKey({ type: 'uuid' }) id!: string
  @Property({ type: 'datetime' }) visitedAt: Date = new Date()
  /** 打码后的地址，如 1.207.89.* 或 2408:8456:a1::*；无法识别为空串 */
  @Property({ type: 'text' }) maskedIp!: string
  /** ISO 国家代码，未知为空串 */
  @Property({ type: 'text' }) country!: string
  @Property({ type: 'text' }) region!: string
  @Property({ type: 'text' }) city!: string
  /** “设备/浏览器”大类，如 desktop/chrome */
  @Property({ type: 'text' }) device!: string
  @Property({ type: 'text' }) path!: string
  /** 来源域名；空串为直接访问，null 为站内跳转 */
  @Property({ type: 'text', nullable: true }) referrer: string | null = null
}
