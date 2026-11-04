/**
 * @file traffic.service.ts
 * @description 访问构成：计浏览时按页面、来源域名与设备累加当日汇总，后台按 7/30/90 天查询趋势与排行。
 *   只写汇总数字；每天每个维度的不同键有上限，超出计入 (other)；访问构成保留 365 天，在写入时顺带清理。
 */
import { randomUUID } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { EntityManager } from '@mikro-orm/postgresql'
import type { TrafficDimension } from '../../entities/site-traffic-daily.entity'
import { beijingDay } from './presence-time'
import { OTHER_KEY, shiftDay, TRAFFIC_KEYS_PER_DAY, TRAFFIC_RETENTION_DAYS } from './traffic-keys'

export interface TrafficInput {
  path: string
  /** 来源域名，空串为直接访问；null 表示本次不计来源（站内跳转） */
  referrer: string | null
  /** 当日首次到访时的“设备/浏览器”；不是首次到访为 null */
  device: string | null
}

export interface TrafficReport {
  from: string
  to: string
  days: { date: string; views: number; visitors: number }[]
  totals: { views: number; visitors: number }
  pages: { key: string; count: number }[]
  referrers: { key: string; count: number }[]
  devices: { key: string; count: number }[]
  browsers: { key: string; count: number }[]
}

/** 排行最多返回的条数 */
const TOP = 10

@Injectable()
export class TrafficService {
  private prunedDay: string | null = null

  constructor(private readonly em: EntityManager) {}

  /** 在计浏览的事务内调用：页面必计，来源与设备按需计 */
  async record(em: EntityManager, day: string, input: TrafficInput): Promise<void> {
    await this.increment(em, { day, dimension: 'page', key: input.path, cap: TRAFFIC_KEYS_PER_DAY.page })
    if (input.referrer !== null)
      await this.increment(em, { day, dimension: 'referrer', key: input.referrer, cap: TRAFFIC_KEYS_PER_DAY.referrer })
    if (input.device !== null) await this.increment(em, { day, dimension: 'device', key: input.device, cap: null })
  }

  /** 每个进程每天最多清理一次超出保留期的访问构成 */
  async prune(day: string): Promise<void> {
    if (this.prunedDay === day) return
    this.prunedDay = day
    await this.em
      .fork()
      .getConnection()
      .execute('delete from site_traffic_daily where day < ?::date', [shiftDay(day, -TRAFFIC_RETENTION_DAYS)])
  }

  async report(days: number, now = new Date()): Promise<TrafficReport> {
    const to = beijingDay(now)
    const from = shiftDay(to, -(days - 1))
    const connection = this.em.fork().getConnection()
    const daily = await connection.execute<{ day: string; views: number; visitors: number }[]>(
      `select to_char(day, 'YYYY-MM-DD') as day, views, visitors from site_daily_stats
       where day between ?::date and ?::date`,
      [from, to],
    )
    const byDay = new Map(daily.map((row) => [row.day, row]))
    const series = Array.from({ length: days }, (_, index) => {
      const date = shiftDay(from, index)
      const row = byDay.get(date)
      return { date, views: row?.views ?? 0, visitors: row?.visitors ?? 0 }
    })
    const grouped = await connection.execute<{ dimension: TrafficDimension; key: string; count: number }[]>(
      `select dimension, key, sum(count)::int as count from site_traffic_daily
       where day between ?::date and ?::date group by dimension, key order by count desc, key`,
      [from, to],
    )
    const of = (dimension: TrafficDimension) =>
      grouped.filter((row) => row.dimension === dimension).map(({ key, count }) => ({ key, count }))
    const devices = of('device')
    return {
      from,
      to,
      days: series,
      totals: {
        views: series.reduce((sum, day) => sum + day.views, 0),
        visitors: series.reduce((sum, day) => sum + day.visitors, 0),
      },
      pages: of('page').slice(0, TOP),
      referrers: of('referrer').slice(0, TOP),
      devices: sumBy(devices, (key) => key.split('/')[0]!),
      browsers: sumBy(devices, (key) => key.split('/')[1] ?? 'other'),
    }
  }

  /** 已有键直接累加；新键在当日未达上限时登记，否则计入 (other) */
  private async increment(
    em: EntityManager,
    { day, dimension, key, cap }: { day: string; dimension: TrafficDimension; key: string; cap: number | null },
  ): Promise<void> {
    const connection = em.getConnection()
    const context = em.getTransactionContext()
    const upsert = `insert into site_traffic_daily (id, day, dimension, key, count) select ?, ?::date, ?, ?, 1`
    const conflict = ` on conflict (day, dimension, key) do update set count = site_traffic_daily.count + 1 returning id`
    if (cap !== null && key !== OTHER_KEY) {
      const rows = await connection.execute<{ id: string }[]>(
        `${upsert} where exists (select 1 from site_traffic_daily where day = ?::date and dimension = ? and key = ?)
           or (select count(*) from site_traffic_daily where day = ?::date and dimension = ?) < ?${conflict}`,
        [randomUUID(), day, dimension, key, day, dimension, key, day, dimension, cap],
        'all',
        context,
      )
      if (rows.length > 0) return
      key = OTHER_KEY
    }
    await connection.execute(`${upsert}${conflict}`, [randomUUID(), day, dimension, key], 'all', context)
  }
}

function sumBy(rows: { key: string; count: number }[], pick: (key: string) => string) {
  const totals = new Map<string, number>()
  for (const row of rows) totals.set(pick(row.key), (totals.get(pick(row.key)) ?? 0) + row.count)
  return [...totals]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
}
