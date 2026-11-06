/**
 * @file site-presence.entity.ts
 * @description 实时在线与访问统计的运行配置和博主最后在线时间（单行 id='default'）。
 *   属于运行数据而非内容：完整备份包含，内容包不导出；自动在线与公开统计默认开启，隐身与近期访问默认关闭。
 */
import { Entity, PrimaryKey, Property } from '@mikro-orm/core'

@Entity({ tableName: 'site_presence' })
export class SitePresence {
  @PrimaryKey({ type: 'text' }) id!: string
  /** 状态类型为“自动”时，按博主心跳显示在线或“N 小时前在线” */
  @Property({ type: 'boolean', default: true }) autoPresence: boolean = true
  /** 是否公开当前在线人数与访问统计 */
  @Property({ type: 'boolean', default: true }) publicStats: boolean = true
  /** 隐身：博主照常记录活动，但对访客按离线处理，也不公开最后在线时间 */
  @Property({ type: 'boolean', default: false }) invisible: boolean = false
  /** 近期访问明细（打码 IP、地区、设备，保留 7 天）；默认关闭，关闭时清空已记录的明细 */
  @Property({ type: 'boolean', default: false }) recentVisits: boolean = false
  /** 博主最后一次心跳时间；写入有节流，重启后仍可显示“N 小时前在线” */
  @Property({ type: 'datetime', nullable: true }) ownerLastSeenAt: Date | null = null
  @Property({ type: 'datetime' }) updatedAt: Date = new Date()
}
