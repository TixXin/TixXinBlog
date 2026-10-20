/**
 * @file calendarGrid.ts
 * @description 日期选择器的纯日期计算：YYYY-MM-DD 解析与格式化、月历 6×7 网格、按天与按月移动；
 *              一律使用本地日历日期，不涉及时区换算
 * @author TixXin
 * @since 2026-10-20
 */

export interface CalendarDate {
  year: number
  /** 0–11 */
  month: number
  day: number
}

export interface CalendarCell extends CalendarDate {
  iso: string
  inMonth: boolean
}

const pad = (value: number) => String(value).padStart(2, '0')

export function toIsoDate({ year, month, day }: CalendarDate): string {
  return `${String(year).padStart(4, '0')}-${pad(month + 1)}-${pad(day)}`
}

/** 解析 YYYY-MM-DD；格式不对或日期不存在（如 2月30日）时返回 null */
export function parseIsoDate(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])]
  const date = new Date(year, month, day)
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null
  return { year, month, day }
}

/**
 * 解析手动输入的日期：接受 2019-03-15、2019/3/15、2019.3.15、2019 3 15 与 20190315，
 * 两侧空白忽略；日期不存在时返回 null
 */
export function parseTypedDate(value: string): CalendarDate | null {
  const text = value.trim()
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(text)
  const parts = compact ?? /^(\d{4})[-/.\s]+(\d{1,2})[-/.\s]+(\d{1,2})$/.exec(text)
  if (!parts) return null
  return parseIsoDate(`${parts[1]}-${parts[2]!.padStart(2, '0')}-${parts[3]!.padStart(2, '0')}`)
}

export function todayDate(now = new Date()): CalendarDate {
  return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() }
}

function fromDate(date: Date): CalendarDate {
  return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() }
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/** 按天移动，跨月跨年自动进位 */
export function addDays(date: CalendarDate, days: number): CalendarDate {
  return fromDate(new Date(date.year, date.month, date.day + days))
}

/** 按月移动；目标月份没有该日时取月末（如 3月31日 前移一月为 2月末） */
export function addMonths(date: CalendarDate, months: number): CalendarDate {
  const target = new Date(date.year, date.month + months, 1)
  const day = Math.min(date.day, daysInMonth(target.getFullYear(), target.getMonth()))
  return { year: target.getFullYear(), month: target.getMonth(), day }
}

/** 月历固定 6 行 × 7 列，首列为 weekStart（0 周日、1 周一），面板高度不随月份变化 */
export function monthGrid(year: number, month: number, weekStart: 0 | 1): CalendarCell[] {
  const offset = (new Date(year, month, 1).getDay() - weekStart + 7) % 7
  return Array.from({ length: 42 }, (_, index) => {
    const date = fromDate(new Date(year, month, 1 - offset + index))
    return { ...date, iso: toIsoDate(date), inMonth: date.month === month && date.year === year }
  })
}

/** 一周内第几列（0–6） */
export function weekdayColumn(date: CalendarDate, weekStart: 0 | 1): number {
  return (new Date(date.year, date.month, date.day).getDay() - weekStart + 7) % 7
}
