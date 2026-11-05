/**
 * @file presence-time.ts
 * @description 访问统计按站点时区切日：只在后端计算日期，前端展示后端给出的数字，SSR 与客户端不会因时区不同而不一致。
 *   心跳频繁，站点时区短时缓存；修改时区只影响之后的日期，已汇总的按日统计不重算。
 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { readSiteTimeZone, siteDay } from '../site/site-time-zone'

/** 时区缓存时长，与在线开关缓存一致 */
const ZONE_CACHE_MS = 10_000

export class SiteDayClock {
  private cache: { zone: string; expires: number } | null = null

  constructor(private readonly em: EntityManager) {}

  /** 当前站点时区（短时缓存） */
  async zone(now: Date): Promise<string> {
    if (this.cache && this.cache.expires > now.getTime()) return this.cache.zone
    const zone = await readSiteTimeZone(this.em.fork())
    this.cache = { zone, expires: now.getTime() + ZONE_CACHE_MS }
    return zone
  }

  /** 某一时刻在站点时区下的 YYYY-MM-DD */
  async day(now: Date): Promise<string> {
    return siteDay(now, await this.zone(now))
  }
}
