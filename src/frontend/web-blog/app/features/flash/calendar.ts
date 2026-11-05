/**
 * @file calendar.ts
 * @description 闪念发布日历与连续天数计算：日期键均为站点时区下的日期，“今天”由调用方按站点时区给出；
 *   网格与连续天数只做日期键运算，与时区无关
 * @author TixXin
 * @since 2026-10-21
 */
import { dayStreak } from '~/features/site/timeZone'

export interface CalendarDay {
  num: number
  dateStr: string
  isToday: boolean
  hasNote: boolean
  isFuture: boolean
  noteCount: number
}

/** 将闪念日期（站点时区）聚合为按日期字符串统计条数的 Map */
export function buildNoteDateMap(dates: { date: string; count: number }[]): Map<string, number> {
  const map = new Map<string, number>()
  dates.forEach(({ date, count }) => {
    const key = date.slice(0, 10)
    map.set(key, (map.get(key) || 0) + count)
  })
  return map
}

/** 生成指定年月的日历网格数据（周一开头，前置空白补 null）；today 为站点时区的今天 */
export function buildCalendarDays(
  viewYear: number,
  viewMonth: number,
  noteDateMap: Map<string, number>,
  todayStr: string,
): (CalendarDay | null)[] {
  const firstDay = new Date(Date.UTC(viewYear, viewMonth, 1))
  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate()

  const startOffset = (firstDay.getUTCDay() + 6) % 7

  const result: (CalendarDay | null)[] = []
  for (let i = 0; i < startOffset; i++) result.push(null)

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const isFuture = dateStr > todayStr
    const noteCount = noteDateMap.get(dateStr) || 0
    result.push({
      num: d,
      dateStr,
      isToday: dateStr === todayStr,
      hasNote: noteCount > 0,
      isFuture,
      noteCount,
    })
  }

  return result
}

/** 计算当前视图月份内的闪念总数 */
export function calculateMonthNoteCount(
  dates: { date: string; count: number }[],
  viewYear: number,
  viewMonth: number,
): number {
  const prefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`
  return dates.reduce((sum, { date, count }) => (date.startsWith(prefix) ? sum + count : sum), 0)
}

/** 计算截至今天或昨天的最长连续发布天数；today 为站点时区的今天 */
export function calculateFlashStreak(noteDateMap: Map<string, number>, today: string): number {
  return dayStreak(noteDateMap.keys(), today)
}
