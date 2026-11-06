/**
 * @file recent-visits.service.ts
 * @description 近期访问明细：开关开启时每次计入浏览记一行（打码 IP、地区、设备、页面与来源），只保留 7 天；
 *   写入时每小时最多顺带清理一次过期行，关闭开关时整表清空。后台按时间倒序分页查看。
 */
import { randomUUID } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { EntityManager } from '@mikro-orm/postgresql'
import type { GeoLocation } from './geo-lookup'
import { maskIp } from './geo-lookup'

export const RECENT_VISIT_RETENTION_DAYS = 7
export const RECENT_VISITS_PAGE_SIZE = 50
const PRUNE_INTERVAL_MS = 60 * 60 * 1000

export interface RecentVisitInput {
  ip: string | undefined
  location: GeoLocation
  device: string
  path: string
  referrer: string | null
}

export interface RecentVisitItem {
  visitedAt: string
  maskedIp: string
  country: string
  region: string
  city: string
  device: string
  path: string
  referrer: string | null
}

@Injectable()
export class RecentVisitsService {
  private prunedAt = 0

  constructor(private readonly em: EntityManager) {}

  async record(input: RecentVisitInput, now = new Date()): Promise<void> {
    const connection = this.em.fork().getConnection()
    await connection.execute(
      `insert into site_recent_visit (id, visited_at, masked_ip, country, region, city, device, path, referrer)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        now,
        maskIp(input.ip),
        input.location.country,
        input.location.region,
        input.location.city,
        input.device,
        input.path,
        input.referrer,
      ],
    )
    if (now.getTime() - this.prunedAt < PRUNE_INTERVAL_MS) return
    this.prunedAt = now.getTime()
    await connection.execute(`delete from site_recent_visit where visited_at < ?`, [
      new Date(now.getTime() - RECENT_VISIT_RETENTION_DAYS * 86400000),
    ])
  }

  /** 关闭开关时清空全部明细 */
  async clear(): Promise<void> {
    await this.em.fork().getConnection().execute('delete from site_recent_visit')
  }

  async list(
    page: number,
    now = new Date(),
  ): Promise<{ items: RecentVisitItem[]; total: number; page: number; pageSize: number }> {
    const connection = this.em.fork().getConnection()
    const since = new Date(now.getTime() - RECENT_VISIT_RETENTION_DAYS * 86400000)
    const [count] = await connection.execute<{ total: number }[]>(
      `select count(*)::int as total from site_recent_visit where visited_at >= ?`,
      [since],
    )
    const rows = await connection.execute<
      {
        visited_at: Date
        masked_ip: string
        country: string
        region: string
        city: string
        device: string
        path: string
        referrer: string | null
      }[]
    >(
      `select visited_at, masked_ip, country, region, city, device, path, referrer from site_recent_visit
       where visited_at >= ? order by visited_at desc, id limit ? offset ?`,
      [since, RECENT_VISITS_PAGE_SIZE, (page - 1) * RECENT_VISITS_PAGE_SIZE],
    )
    return {
      items: rows.map((row) => ({
        visitedAt: new Date(row.visited_at).toISOString(),
        maskedIp: row.masked_ip,
        country: row.country,
        region: row.region,
        city: row.city,
        device: row.device,
        path: row.path,
        referrer: row.referrer,
      })),
      total: count?.total ?? 0,
      page,
      pageSize: RECENT_VISITS_PAGE_SIZE,
    }
  }
}
