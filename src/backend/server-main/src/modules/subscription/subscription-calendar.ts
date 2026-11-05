/** @file subscription-calendar.ts @description 博主私密续费日历（iCalendar）：未来 12 个月的扣费日生成全天事件并提前一天提醒 */
import { formatAmount, scheduleDates } from '@tixxin/subscription-domain'
import type { SubscriptionLike } from '@tixxin/subscription-domain'

export interface CalendarRecord extends SubscriptionLike {
  description?: string
}
/** RFC 5545 文本转义：反斜杠、分号、逗号与换行 */
export function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}
/** 按 75 个 UTF-8 字节折行，续行以一个空格开头，不在多字节字符中间截断 */
export function foldLine(line: string): string {
  const encoder = new TextEncoder()
  const parts: string[] = []
  let current = '',
    bytes = 0
  for (const character of line) {
    const size = encoder.encode(character).length
    const limit = parts.length ? 74 : 75
    if (bytes + size > limit) {
      parts.push(current)
      current = ''
      bytes = 0
    }
    current += character
    bytes += size
  }
  parts.push(current)
  return parts.join('\r\n ')
}
const compactDate = (date: string) => date.replace(/-/g, '')
function nextDay(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}
function eventLines(record: CalendarRecord, date: string, stamp: string, host: string): string[] {
  const amount = formatAmount(record.amount, record.currency)
  const summary =
    record.subscriptionStatus === 'trial' ? `试用转正：${record.name} ${amount}` : `续费：${record.name} ${amount}`
  return [
    'BEGIN:VEVENT',
    `UID:subscription-${record.id}-${compactDate(date)}@${host}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compactDate(date)}`,
    `DTEND;VALUE=DATE:${compactDate(nextDay(date))}`,
    `SUMMARY:${escapeText(summary)}`,
    ...(record.description ? [`DESCRIPTION:${escapeText(record.description.slice(0, 500))}`] : []),
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(summary)}`,
    'TRIGGER:-P1D',
    'END:VALARM',
    'END:VEVENT',
  ]
}
/** 生成完整日历文本（CRLF 换行）；记录按传入顺序、日期升序输出 */
export function buildCalendar(records: readonly CalendarRecord[], today: string, now: Date, host: string): string {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
  const events = records
    .flatMap((record) => scheduleDates(record, today).map((date) => ({ record, date })))
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.record.id).localeCompare(String(b.record.id)))
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${host}//subscriptions//ZH`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText('订阅续费')}`,
    ...events.flatMap(({ record, date }) => eventLines(record, date, stamp, host)),
    'END:VCALENDAR',
  ]
  return lines.map(foldLine).join('\r\n') + '\r\n'
}
