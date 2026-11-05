/**
 * @file timeZone.ts
 * @description 站点时区下的取日：日历、时间胶囊、留言分组与订阅“今天”统一按站点资料中的时区把时刻换算成日期，
 *   与后端分日口径一致；SSR 与浏览器得到同一结果，不受服务器或访客本机时区影响。
 *   只做 YYYY-MM-DD 之间的加减与星期推算时与时区无关，按 UTC 运算即可。
 */
import { tryUseNuxtApp, useState } from 'nuxt/app'
import type { DateInput } from '~/utils/format'

export const DEFAULT_SITE_TIME_ZONE = 'Asia/Shanghai'

const formatters = new Map<string, Intl.DateTimeFormat>()
function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let value = formatters.get(timeZone)
  if (!value) {
    try {
      value = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      // 运行环境不认识的时区回到默认值，避免整页报错
      value = partsFormatter(DEFAULT_SITE_TIME_ZONE)
    }
    formatters.set(timeZone, value)
  }
  return value
}

function zonedParts(value: DateInput | null | undefined, timeZone: string): Record<string, string> | null {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return Object.fromEntries(
    partsFormatter(timeZone)
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  )
}

/** 某一时刻在站点时区下的日期 YYYY-MM-DD；已是纯日期时原样返回，空值或非法时间返回空串 */
export function siteDayKey(value: DateInput | null | undefined, timeZone: string): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const parts = zonedParts(value, timeZone)
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : ''
}

/** 某一时刻在站点时区下的 YYYY-MM-DD HH:mm，供后台列表展示；空值或非法时间返回空串 */
export function siteDateTime(value: DateInput | null | undefined, timeZone: string): string {
  const parts = zonedParts(value, timeZone)
  return parts ? `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}` : ''
}

/** 站点时区下的年与月（月份从 0 开始，与日历视图一致） */
export function siteYearMonth(value: DateInput, timeZone: string): { year: number; month: number } {
  const [year = 1970, month = 1] = siteDayKey(value, timeZone).split('-').map(Number)
  return { year, month: month - 1 }
}

/** YYYY-MM-DD 前后推 n 天 */
export function shiftDayKey(day: string, offset: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

/** 两个 YYYY-MM-DD 相差的天数（later - earlier） */
export function dayKeyDiff(later: string, earlier: string): number {
  return Math.round((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86_400_000)
}

/** 截至今天或昨天的连续天数：最近一天早于昨天时为 0 */
export function dayStreak(days: Iterable<string>, today: string): number {
  const set = new Set(days)
  const latest = [...set].sort().at(-1)
  if (!latest || dayKeyDiff(today, latest) > 1) return 0
  let count = 0
  for (let day = latest; set.has(day); day = shiftDayKey(day, -1)) count++
  return count
}

/** 后台可选的时区：运行环境支持的 IANA 时区名加 UTC；当前值不在列表中时补在最前 */
export function siteTimeZoneOptions(current = ''): string[] {
  const zones = ['UTC', ...(Intl.supportedValuesOf?.('timeZone') ?? [DEFAULT_SITE_TIME_ZONE])]
  return current && !zones.includes(current) ? [current, ...zones] : zones
}

/**
 * 非组件模块（如接口归一化）读取当前站点时区：在 Nuxt 上下文中取站点资料状态，脱离上下文时按默认值。
 * 需在 await 之前调用，异步续体里 Nuxt 上下文可能已丢失。
 */
export function currentSiteTimeZone(): string {
  const app = tryUseNuxtApp()
  const zone = app?.runWithContext(() => useState<{ timeZone?: string } | undefined>('site-settings').value?.timeZone)
  return typeof zone === 'string' && zone ? zone : DEFAULT_SITE_TIME_ZONE
}
