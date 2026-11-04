/**
 * @file site-daily-stats.entity.ts
 * @description 按北京时间日期汇总的全站浏览次数与当日访客数；累计浏览为全部日期之和，从功能上线起计。
 */
import { Entity, PrimaryKey, Property } from '@mikro-orm/core'

@Entity({ tableName: 'site_daily_stats' })
export class SiteDailyStats {
  @PrimaryKey({ type: 'date' }) day!: string
  @Property({ type: 'integer', default: 0 }) views: number = 0
  @Property({ type: 'integer', default: 0 }) visitors: number = 0
}
