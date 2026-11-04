/**
 * @file site-traffic-daily.entity.ts
 * @description 按北京时间日期汇总的访问构成：页面（路径的浏览次数）、来源（落地浏览的来源域名，空串为直接访问）、
 *   设备（当日首次到访访客的“设备/浏览器大类”）。只存汇总数字，不存 IP、完整 User-Agent 或完整来源地址；保留 365 天。
 */
import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/core'

export type TrafficDimension = 'page' | 'referrer' | 'device'

@Entity({ tableName: 'site_traffic_daily' })
@Unique({ properties: ['day', 'dimension', 'key'] })
export class SiteTrafficDaily {
  /** 应用层生成；供开发样本登记归属 */
  @PrimaryKey({ type: 'uuid' }) id!: string
  @Property({ type: 'date' }) day!: string
  @Property({ type: 'text' }) dimension!: TrafficDimension
  /** page 为路径，referrer 为域名（空串为直接访问），device 为“设备/浏览器”；超出当日上限归入 (other) */
  @Property({ type: 'text' }) key!: string
  @Property({ type: 'integer', default: 0 }) count: number = 0
}
