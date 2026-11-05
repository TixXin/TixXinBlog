/**
 * @file site-time-zone.ts
 * @description 站点时区：全站分日（日历、热力图、归档、统计）的唯一取日入口。
 *   时区保存在站点资料中，缺省为 Asia/Shanghai；分日只在后端按该时区计算，或由后端随数据给出，
 *   前端按同一时区展示，SSR 与客户端不因服务器或浏览器的本机时区不同而切日不一致。
 */
import type { EntityManager } from '@mikro-orm/postgresql'

export const DEFAULT_SITE_TIME_ZONE = 'Asia/Shanghai'

/** 可选的时区：运行时支持的 IANA 时区名，外加 UTC */
export function siteTimeZoneOptions(): string[] {
  return ['UTC', ...Intl.supportedValuesOf('timeZone')]
}

const SUPPORTED = new Set(siteTimeZoneOptions())

export function isSiteTimeZone(value: unknown): value is string {
  return typeof value === 'string' && SUPPORTED.has(value)
}

/** 历史记录或旧内容包没有时区时按默认值读取；无法识别的值同样回到默认值，避免分日查询报错 */
export function siteTimeZoneOf(values: { timeZone?: string } | null | undefined): string {
  return isSiteTimeZone(values?.timeZone) ? values.timeZone : DEFAULT_SITE_TIME_ZONE
}

/**
 * 站点时区的 SQL 子查询，供单条统计语句内联使用，免去一次往返。
 * 保存与内容包迁入都校验为 IANA 名，库中不会出现无法识别的值；缺失时同样回到默认值。
 */
export const SITE_TIME_ZONE_SQL = `(select coalesce(nullif(values->>'timeZone',''),'${DEFAULT_SITE_TIME_ZONE}') from site_settings where id='default')`

/** 读取当前站点时区；主键单行读取，不经身份映射，保存后立即生效 */
export async function readSiteTimeZone(em: Pick<EntityManager, 'execute'>): Promise<string> {
  const [row] = await em.execute<{ time_zone: string | null }[]>(
    "select values->>'timeZone' as time_zone from site_settings where id = 'default'",
  )
  return siteTimeZoneOf({ timeZone: row?.time_zone ?? undefined })
}

const formatters = new Map<string, Intl.DateTimeFormat>()
function formatter(timeZone: string) {
  let value = formatters.get(timeZone)
  if (!value) {
    value = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatters.set(timeZone, value)
  }
  return value
}

/** 某一时刻在站点时区下的年月日时分秒 */
export function zonedParts(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  )
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

/** 某一时刻在站点时区下的日期 YYYY-MM-DD */
export function siteDay(date: Date, timeZone: string): string {
  const { year, month, day } = zonedParts(date, timeZone)
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** 站点时区相对 UTC 的偏移毫秒数（该时刻适用的偏移，含夏令时） */
function offsetAt(time: number, timeZone: string): number {
  const p = zonedParts(new Date(time), timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(time / 1000) * 1000
}

/** 站点时区某日（月份可越界，按公历顺延）零点对应的时刻 */
export function zonedDayStart(year: number, month: number, day: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day)
  const first = guess - offsetAt(guess, timeZone)
  // 夏令时切换日按零点当时的偏移再校正一次
  return new Date(guess - offsetAt(first, timeZone))
}

/** YYYY-MM-DD 在站点时区的零点 */
export function zonedDayStartOf(value: string, timeZone: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return zonedDayStart(year!, month!, day!, timeZone)
}
