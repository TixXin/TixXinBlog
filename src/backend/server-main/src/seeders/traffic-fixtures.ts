/**
 * @file traffic-fixtures.ts
 * @description 访问统计开发样本：截至昨天（站点时区）的 30 天按日汇总，含工作日与周末起伏、热门页面、
 *   直接访问与站外来源、桌面与移动设备、国家与省份（含未知地区）；只补没有真实记录的日期，不改动今天的实时计数。
 *   数字为开发代表值；每日浏览等于各页面浏览之和，每日访客等于各设备访客之和、也等于各国家访客之和，
 *   各国省份之和等于该国访客数。
 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { randomUUID } from 'node:crypto'
import { readSiteTimeZone, siteDay } from '../modules/site/site-time-zone'
import { shiftDay } from '../modules/presence/traffic-keys'
import type { TrafficDimension } from '../entities/site-traffic-daily.entity'
import { ensureFixture } from './fixture-ledger'
import type { FixtureProgress } from './fixture-ledger'

export const TRAFFIC_DATASET = 'traffic-v1'
export const TRAFFIC_DAYS = 30
const STATIC_PAGES: [string, number][] = [
  ['/', 30],
  ['/archive', 9],
  ['/moments', 7],
  ['/links', 4],
]
/** 文章页取最新三篇公开文章，权重依次递减 */
const ARTICLE_WEIGHTS = [16, 10, 6]
const REFERRERS: [string, number][] = [
  ['', 9],
  ['google.com', 6],
  ['github.com', 3],
  ['bing.com', 2],
  ['v2ex.com', 1],
]
const DEVICES: [string, number][] = [
  ['desktop/chrome', 9],
  ['mobile/safari', 6],
  ['desktop/safari', 3],
  ['mobile/chrome', 2],
]
/** 国家用 ISO 代码，空串为查不到地区的访客 */
const COUNTRIES: [string, number][] = [
  ['CN', 16],
  ['US', 3],
  ['JP', 1],
  ['SG', 1],
  ['', 1],
]
/** 有省份分布的国家：省份键为“代码/名称”，名称与 ip2region 的写法一致 */
const REGIONS: Record<string, [string, number][]> = {
  CN: [
    ['CN/广东省', 6],
    ['CN/北京市', 4],
    ['CN/上海市', 3],
    ['CN/浙江省', 2],
    ['CN/贵州省', 1],
  ],
  US: [
    ['US/California', 2],
    ['US/Washington', 1],
  ],
}
export const TRAFFIC_FIXTURE_COUNT =
  TRAFFIC_DAYS *
  (1 +
    STATIC_PAGES.length +
    ARTICLE_WEIGHTS.length +
    REFERRERS.length +
    DEVICES.length +
    COUNTRIES.length +
    Object.values(REGIONS).reduce((sum, list) => sum + list.length, 0))

/** 按权重把总数分给各项（最大余数法），保证各项之和等于总数 */
export function distribute(total: number, weights: [string, number][]): [string, number][] {
  const sum = weights.reduce((acc, [, weight]) => acc + weight, 0)
  const exact = weights.map(([key, weight]) => [key, (total * weight) / sum] as const)
  const result = exact.map(([key, value]) => [key, Math.floor(value)] as [string, number])
  let rest = total - result.reduce((acc, [, value]) => acc + value, 0)
  const order = exact
    .map(([, value], index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  for (const { index } of order) {
    if (rest <= 0) break
    result[index]![1] += 1
    rest -= 1
  }
  return result
}

/** 第 offset 天（0 为最早一天）的访客数：周末略低，月中有一次文章分享带来的高峰 */
export function dailyVisitors(day: string, offset: number): number {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay()
  const weekend = weekday === 0 || weekday === 6
  const wave = Math.round(6 * Math.sin(offset / 4))
  const peak = offset === 17 ? 38 : offset === 18 ? 15 : 0
  return Math.max(4, 22 + wave + peak - (weekend ? 7 : 0))
}

async function insertRow(em: EntityManager, sql: string, params: unknown[]): Promise<string | null> {
  const rows = await em.execute<{ id: string }[]>(sql, params)
  return rows[0]?.id ?? null
}

/** 该日已有统计行，且不是本数据集登记过的样本 */
async function realDay(em: EntityManager, day: string): Promise<boolean> {
  const [row] = await em.execute<{ real: boolean }[]>(
    `select exists (select 1 from site_daily_stats where day = ?::date)
       and not exists (select 1 from development_fixture where key = ?) as real`,
    [day, `${TRAFFIC_DATASET}/traffic-day/${day}/day`],
  )
  return row?.real === true
}

export async function seedTrafficFixtures(em: EntityManager, _storage: unknown, progress: FixtureProgress) {
  const posts = await em.execute<{ id: number }[]>(
    `select id from post where status = 'published' and deleted_at is null order by published_at desc nulls last, id desc limit ?`,
    [ARTICLE_WEIGHTS.length],
  )
  const pages: [string, number][] = [
    ...STATIC_PAGES,
    ...posts.map((post, index) => [`/articles/${post.id}`, ARTICLE_WEIGHTS[index]!] as [string, number]),
  ]
  const yesterday = shiftDay(siteDay(new Date(), await readSiteTimeZone(em)), -1)
  for (let offset = 0; offset < TRAFFIC_DAYS; offset++) {
    const day = shiftDay(yesterday, offset - (TRAFFIC_DAYS - 1))
    const visitors = dailyVisitors(day, offset)
    const views = Math.round(visitors * (2.1 + (offset % 3) * 0.2))
    // 已有真实统计且不归样本所有的日期直接跳过，避免与实际数字混在一起，也不记为不可用。
    if (await realDay(em, day)) continue
    const owned = await ensureFixture(
      em,
      TRAFFIC_DATASET,
      `${day}/day`,
      'traffic-day',
      () =>
        insertRow(
          em,
          `insert into site_daily_stats (id, day, views, visitors) values (?, ?::date, ?, ?) on conflict (day) do nothing returning id`,
          [randomUUID(), day, views, visitors],
        ),
      progress,
    )
    if (!owned) continue
    const countries = distribute(visitors, COUNTRIES)
    const groups: [TrafficDimension, [string, number][]][] = [
      ['page', distribute(views, pages)],
      ['referrer', distribute(visitors, REFERRERS)],
      ['device', distribute(visitors, DEVICES)],
      ['country', countries],
      ['region', countries.flatMap(([code, count]) => (REGIONS[code] ? distribute(count, REGIONS[code]) : []))],
    ]
    for (const [dimension, entries] of groups)
      for (const [key, count] of entries)
        await ensureFixture(
          em,
          TRAFFIC_DATASET,
          `${day}/${dimension}/${key || '(direct)'}`,
          'traffic',
          () =>
            insertRow(
              em,
              `insert into site_traffic_daily (id, day, dimension, key, count) values (?, ?::date, ?, ?, ?)
               on conflict (day, dimension, key) do nothing returning id`,
              [randomUUID(), day, dimension, key, count],
            ),
          progress,
        )
  }
}
