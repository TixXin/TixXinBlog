/** @file subscription-calendar.spec.ts @description 续费日历的 RFC 5545 转义、折行与事件生成 */
import { buildCalendar, escapeText, foldLine } from './subscription-calendar'
import type { CalendarRecord } from './subscription-calendar'

const record = (overrides: Partial<CalendarRecord> = {}): CalendarRecord => ({
  id: 7,
  name: '云盘',
  category: 'cloud',
  currency: 'USD',
  amount: 2000,
  billingCycle: 'monthly',
  subscriptionStatus: 'active',
  startDate: '2026-01-31',
  nextBillingDate: '2026-11-30',
  trialEndDate: null,
  endDate: null,
  ...overrides,
})

describe('续费日历', () => {
  it('转义分号、逗号、反斜杠与换行', () => {
    expect(escapeText('a;b,c\\d\ne')).toBe('a\\;b\\,c\\\\d\\ne')
  })

  it('按 75 字节折行且不截断中文字符', () => {
    const folded = foldLine(`SUMMARY:${'续'.repeat(40)}`)
    const lines = folded.split('\r\n')
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75)
    expect(lines.map((line, index) => (index ? line.slice(1) : line)).join('')).toBe(`SUMMARY:${'续'.repeat(40)}`)
  })

  it('未来 12 个月的扣费日生成全天事件，保留月底锚点并提前一天提醒', () => {
    const text = buildCalendar([record()], '2026-11-06', new Date('2026-11-06T01:02:03.456Z'), 'host')
    expect(text.endsWith('\r\n')).toBe(true)
    expect(text).toContain('DTSTART;VALUE=DATE:20261130')
    expect(text).toContain('DTEND;VALUE=DATE:20261201')
    expect(text).toContain('DTSTART;VALUE=DATE:20270131')
    expect(text).toContain('DTSTART;VALUE=DATE:20270228')
    expect(text).toContain('UID:subscription-7-20261130@host')
    expect(text).toContain('DTSTAMP:20261106T010203Z')
    expect(text).toContain('SUMMARY:续费：云盘 USD 20.00')
    expect(text).toContain('TRIGGER:-P1D')
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(12)
  })

  it('试用记录在到期日生成转正事件，已结束与暂停的记录不生成', () => {
    const text = buildCalendar(
      [
        record({
          id: 1,
          subscriptionStatus: 'trial',
          startDate: '2026-11-01',
          trialEndDate: '2026-11-20',
          nextBillingDate: null,
        }),
        record({ id: 2, endDate: '2026-11-15' }),
        record({ id: 3, subscriptionStatus: 'paused' }),
      ],
      '2026-11-06',
      new Date('2026-11-06T00:00:00.000Z'),
      'host',
    )
    expect(text).toContain('SUMMARY:试用转正：云盘 USD 20.00')
    expect(text).toContain('UID:subscription-1-20261120@host')
    expect(text).not.toContain('UID:subscription-2-')
    expect(text).not.toContain('UID:subscription-3-')
  })
})
