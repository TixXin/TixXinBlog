/** @file site-time-zone.spec.ts @description 站点时区校验、缺省回退、取日与时区零点换算（含夏令时） */
import {
  DEFAULT_SITE_TIME_ZONE,
  isSiteTimeZone,
  siteDay,
  siteTimeZoneOf,
  zonedDayStart,
  zonedDayStartOf,
} from './site-time-zone'

describe('站点时区校验', () => {
  it('接受 IANA 时区名与 UTC，拒绝缩写、偏移量和不存在的名称', () => {
    expect(isSiteTimeZone('Asia/Shanghai')).toBe(true)
    expect(isSiteTimeZone('America/New_York')).toBe(true)
    expect(isSiteTimeZone('UTC')).toBe(true)
    for (const value of ['Asia/Beijing', 'CST', '+08:00', '', null, 8]) expect(isSiteTimeZone(value)).toBe(false)
  })

  it('缺失或无法识别时回到默认的 Asia/Shanghai', () => {
    expect(DEFAULT_SITE_TIME_ZONE).toBe('Asia/Shanghai')
    expect(siteTimeZoneOf({})).toBe('Asia/Shanghai')
    expect(siteTimeZoneOf(null)).toBe('Asia/Shanghai')
    expect(siteTimeZoneOf({ timeZone: 'Mars/Base' })).toBe('Asia/Shanghai')
    expect(siteTimeZoneOf({ timeZone: 'Europe/Berlin' })).toBe('Europe/Berlin')
  })
})

describe('按站点时区取日', () => {
  it('UTC 16:00 是北京时间次日 00:00', () => {
    expect(siteDay(new Date('2026-11-04T15:59:59Z'), 'Asia/Shanghai')).toBe('2026-11-04')
    expect(siteDay(new Date('2026-11-04T16:00:00Z'), 'Asia/Shanghai')).toBe('2026-11-05')
    expect(siteDay(new Date('2026-12-31T16:00:00Z'), 'Asia/Shanghai')).toBe('2027-01-01')
  })

  it('UTC 与西半球时区各自切日', () => {
    expect(siteDay(new Date('2026-11-05T03:00:00Z'), 'UTC')).toBe('2026-11-05')
    expect(siteDay(new Date('2026-11-05T03:00:00Z'), 'America/New_York')).toBe('2026-11-04')
  })
})

describe('时区零点换算', () => {
  it('北京时间零点为前一天 UTC 16:00', () => {
    expect(zonedDayStartOf('2026-11-05', 'Asia/Shanghai').toISOString()).toBe('2026-11-04T16:00:00.000Z')
    expect(zonedDayStart(2026, 13, 1, 'Asia/Shanghai').toISOString()).toBe('2026-12-31T16:00:00.000Z')
  })

  it('夏令时前后使用各自的偏移', () => {
    expect(zonedDayStartOf('2026-07-01', 'Europe/Berlin').toISOString()).toBe('2026-06-30T22:00:00.000Z')
    expect(zonedDayStartOf('2026-12-01', 'Europe/Berlin').toISOString()).toBe('2026-11-30T23:00:00.000Z')
    // 切换日当天零点仍按切换前的偏移
    expect(zonedDayStartOf('2026-03-29', 'Europe/Berlin').toISOString()).toBe('2026-03-28T23:00:00.000Z')
    expect(zonedDayStartOf('2026-10-25', 'Europe/Berlin').toISOString()).toBe('2026-10-24T22:00:00.000Z')
  })
})
