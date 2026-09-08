/**
 * @file useRelativeDate.test.ts
 * @description formatRelativeDate 纯函数单元测试
 * @author TixXin
 * @since 2026-04-03
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatCalendarDate, formatRelativeDate } from '../../app/composables/useRelativeDate'

describe('formatRelativeDate', () => {
  it('ISO时间显示统一日历日期，非法时间不泄露NaN或原文', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-03T10:00:00'))
    expect(formatRelativeDate('2026-03-20T18:20:00.000Z')).toBe('发布于 2026-03-20')
    expect(formatCalendarDate('2026-04-20')).toBe('2026-04-20')
    expect(formatRelativeDate('not-a-date')).toBe('发布日期未知')
    expect(formatRelativeDate('2026-02-30')).toBe('发布日期未知')
    expect(formatCalendarDate('')).toBe('日期未知')
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('今天的日期返回"发布于今天"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-03T10:00:00'))

    expect(formatRelativeDate('2026-04-03')).toBe('发布于今天')
  })

  it('昨天的日期返回"发布于昨天"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-03T10:00:00'))

    expect(formatRelativeDate('2026-04-02')).toBe('发布于昨天')
  })

  it('3 天前返回"发布于3天前"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-03T10:00:00'))

    expect(formatRelativeDate('2026-03-31')).toBe('发布于3天前')
  })

  it('7 天前返回"发布于7天前"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-10T10:00:00'))

    expect(formatRelativeDate('2026-04-03')).toBe('发布于7天前')
  })

  it('超过 7 天返回完整日期', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-15T10:00:00'))

    expect(formatRelativeDate('2026-04-03')).toBe('发布于 2026-04-03')
  })

  it('未来日期也返回完整日期', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-03T10:00:00'))

    expect(formatRelativeDate('2026-04-10')).toBe('发布于 2026-04-10')
  })
})
