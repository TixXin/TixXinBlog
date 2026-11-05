/**
 * @file siteTimeZone.test.ts
 * @description 站点时区取日：时刻按站点时区换算日期与时间、纯日期原样保留、非法输入、日期键运算、连续天数与可选时区列表
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SITE_TIME_ZONE,
  dayKeyDiff,
  dayStreak,
  shiftDayKey,
  siteDateTime,
  siteDayKey,
  siteTimeZoneOptions,
  siteYearMonth,
} from '../../app/features/site/timeZone'

describe('站点时区取日', () => {
  it('UTC 16:00 是北京时间次日，西半球时区仍是前一天', () => {
    expect(siteDayKey('2026-11-04T15:59:59Z', 'Asia/Shanghai')).toBe('2026-11-04')
    expect(siteDayKey('2026-11-04T16:00:00Z', 'Asia/Shanghai')).toBe('2026-11-05')
    expect(siteDayKey('2026-11-05T03:00:00Z', 'America/New_York')).toBe('2026-11-04')
    expect(siteDayKey(new Date('2026-12-31T16:00:00Z'), 'Asia/Shanghai')).toBe('2027-01-01')
  })

  it('纯日期原样返回，空值与非法时间返回空串，不认识的时区回到默认值', () => {
    expect(siteDayKey('2026-03-01', 'America/New_York')).toBe('2026-03-01')
    expect(siteDayKey('', 'UTC')).toBe('')
    expect(siteDayKey(null, 'UTC')).toBe('')
    expect(siteDayKey('not-a-date', 'UTC')).toBe('')
    expect(siteDayKey('2026-11-04T16:00:00Z', 'Mars/Base')).toBe('2026-11-05')
    expect(DEFAULT_SITE_TIME_ZONE).toBe('Asia/Shanghai')
  })

  it('年月与时间按站点时区，午夜显示为 00 而非 24', () => {
    expect(siteYearMonth('2026-10-31T16:30:00Z', 'Asia/Shanghai')).toEqual({ year: 2026, month: 10 })
    expect(siteDateTime('2026-11-04T16:05:00Z', 'Asia/Shanghai')).toBe('2026-11-05 00:05')
    expect(siteDateTime('2026-11-04T16:05:00Z', 'UTC')).toBe('2026-11-04 16:05')
    expect(siteDateTime('', 'UTC')).toBe('')
  })
})

describe('日期键运算', () => {
  it('跨月、跨年推算与天数差', () => {
    expect(shiftDayKey('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDayKey('2026-12-31', 1)).toBe('2027-01-01')
    expect(dayKeyDiff('2026-03-01', '2026-02-27')).toBe(2)
  })

  it('连续天数截至今天或昨天，中断或早于昨天为 0', () => {
    expect(dayStreak(['2026-11-05', '2026-11-04', '2026-11-03', '2026-11-01'], '2026-11-05')).toBe(3)
    expect(dayStreak(['2026-11-04', '2026-11-03'], '2026-11-05')).toBe(2)
    expect(dayStreak(['2026-11-03'], '2026-11-05')).toBe(0)
    expect(dayStreak([], '2026-11-05')).toBe(0)
  })
})

describe('可选时区', () => {
  it('包含 UTC 与 Asia/Shanghai，当前值不在列表中时补在最前', () => {
    const options = siteTimeZoneOptions()
    expect(options[0]).toBe('UTC')
    expect(options).toContain('Asia/Shanghai')
    expect(siteTimeZoneOptions('Legacy/Zone')[0]).toBe('Legacy/Zone')
  })
})
