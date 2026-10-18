/**
 * @file sidebarCalendars.test.ts
 * @description 侧栏日历覆盖空态、失败、UTC 月日与连续天数、筛选恢复和原生按钮可访问性
 */
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FlashCalendarCard from '../../app/components/sidebar/FlashCalendarCard.vue'
import MomentCalendarCard from '../../app/components/sidebar/MomentCalendarCard.vue'

const mounted: { wrapper: VueWrapper; host: HTMLElement }[] = []
type CalendarKind = 'moment' | 'flash'
type DateCount = { date: string; count: number }

function mountCalendar(kind: CalendarKind, dates: DateCount[] = [], selectedDate?: string | null) {
  const host = document.createElement('div')
  document.body.append(host)
  const options = { attachTo: host, global: { stubs: { Icon: true } } }
  const wrapper =
    kind === 'moment'
      ? mount(MomentCalendarCard, {
          ...options,
          props: { dateCounts: Object.fromEntries(dates.map(({ date, count }) => [date, count])), selectedDate },
        })
      : mount(FlashCalendarCard, { ...options, props: { dates, selectedDate } })
  mounted.push({ wrapper, host })
  return wrapper
}

beforeEach(() => {
  // 东八区已到三月，UTC 仍为闰年二月最后一天；仅替换 Date，不干扰 Nuxt 挂载任务。
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2024-03-01T00:30:00+08:00'))
})

afterEach(() => {
  mounted.splice(0).forEach(({ wrapper, host }) => {
    wrapper.unmount()
    host.remove()
  })
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe.each<CalendarKind>(['moment', 'flash'])('%s 侧栏日历', (kind) => {
  const prefix = `.${kind}-calendar-card`

  it('空数据仍展示完整 UTC 闰月，空白和无内容日期不可操作', async () => {
    const wrapper = await mountCalendar(kind)
    expect(wrapper.get(`${prefix}__month`).text()).toBe('2024年2月')
    expect(wrapper.findAll(`${prefix}__day:not(.is-empty)`)).toHaveLength(29)
    const padding = wrapper.findAll(`${prefix}__day.is-empty`)
    expect(padding).toHaveLength(3)
    padding.forEach((day) => {
      expect(day.attributes('aria-hidden')).toBe('true')
      expect(day.element).toBeInstanceOf(HTMLButtonElement)
      expect((day.element as HTMLButtonElement).disabled).toBe(true)
    })
    expect(wrapper.get(`${prefix}__day.is-today`).text()).toBe('29')
    expect(wrapper.get(`${prefix}__legend`).text()).toContain('本月 0 条')
    expect(wrapper.find(`${prefix}__streak`).exists()).toBe(false)
    const emptyDay = wrapper.get<HTMLButtonElement>(`${prefix}__day:not(.is-empty)`)
    expect(emptyDay.element.disabled).toBe(true)
    emptyDay.element.click()
    expect(wrapper.emitted('select-date')).toBeUndefined()
  })

  it('只累计显示月份并按 UTC 跨闰日计算连续发布天数', async () => {
    const wrapper = await mountCalendar(kind, [
      { date: '2024-02-27', count: 1 },
      { date: '2024-02-28', count: 2 },
      { date: '2024-02-29', count: 3 },
      { date: '2024-01-31', count: 7 },
    ])
    expect(wrapper.get(`${prefix}__legend`).text()).toContain('本月 6 条')
    expect(wrapper.get(`${prefix}__streak`).text()).toBe('连续 3 天')
    expect(wrapper.get(`${prefix}__day.is-today`).attributes('aria-label')).toContain('2024-02-29，3 条')
  })

  it.each([
    { name: '昨天开始且跨年连续', dates: ['2023-12-31', '2023-12-30'], expected: '连续 2 天' },
    { name: '中断一天后不连接较早记录', dates: ['2024-01-01', '2023-12-30'], expected: '连续 1 天' },
    { name: '最近发布已是前天', dates: ['2023-12-30', '2023-12-29'], expected: null },
  ])('$name', async ({ dates, expected }) => {
    vi.setSystemTime(new Date('2024-01-01T00:30:00Z'))
    const wrapper = await mountCalendar(
      kind,
      dates.map((date) => ({ date, count: 1 })),
    )
    const streak = wrapper.find(`${prefix}__streak`)
    expect(streak.exists()).toBe(expected !== null)
    if (expected) expect(streak.text()).toBe(expected)
  })

  it('恢复历史选中月份，响应外部筛选变化并忽略不存在的日期', async () => {
    const wrapper = await mountCalendar(kind, [{ date: '2020-02-29', count: 1 }], '2020-02-29')
    expect(wrapper.get(`${prefix}__month`).text()).toBe('2020年2月')
    expect(wrapper.findAll(`${prefix}__day:not(.is-empty)`)).toHaveLength(29)
    expect(wrapper.get(`${prefix}__day.is-selected`).attributes('aria-pressed')).toBe('true')
    await wrapper.setProps({ selectedDate: '2023-12-31' })
    expect(wrapper.get(`${prefix}__month`).text()).toBe('2023年12月')
    await wrapper.setProps({ selectedDate: '2024-02-30' })
    expect(wrapper.get(`${prefix}__month`).text()).toBe('2023年12月')
    await wrapper.setProps({ selectedDate: '不是日期' })
    expect(wrapper.get(`${prefix}__month`).text()).toBe('2023年12月')
    await wrapper.setProps({ selectedDate: null })
    expect(wrapper.get(`${prefix}__month`).text()).toBe('2023年12月')
  })

  it('原生日期按钮可聚焦，激活后发出 UTC 日期且再次选择取消筛选', async () => {
    const wrapper = await mountCalendar(kind, [{ date: '2024-02-29', count: 2 }])
    const day = wrapper.get<HTMLButtonElement>(`${prefix}__day.is-today`)
    expect(day.element).toBeInstanceOf(HTMLButtonElement)
    expect(day.attributes('type')).toBe('button')
    expect(day.element.disabled).toBe(false)
    expect(day.element.tabIndex).toBe(0)
    expect(day.attributes('aria-pressed')).toBe('false')
    day.element.focus()
    expect(document.activeElement).toBe(day.element)
    // DOM 环境不模拟 Enter/Space 的浏览器默认动作；验证原生按钮及其激活事件。
    day.element.click()
    await nextTick()
    expect(wrapper.emitted('select-date')).toEqual([['2024-02-29']])
    await wrapper.setProps({ selectedDate: '2024-02-29' })
    expect(day.attributes('aria-pressed')).toBe('true')
    day.element.click()
    await nextTick()
    expect(wrapper.emitted('select-date')).toEqual([['2024-02-29'], [null]])
  })

  it('上一月和下一月跨年正确，到 UTC 当前月时禁止前进，今天恢复当前月', async () => {
    vi.setSystemTime(new Date('2025-01-01T00:30:00+08:00'))
    const wrapper = await mountCalendar(kind)
    const previous = wrapper.get<HTMLButtonElement>('button[aria-label="上一月"]')
    const next = wrapper.get<HTMLButtonElement>('button[aria-label="下一月"]')
    expect(wrapper.get(`${prefix}__month`).text()).toBe('2024年12月')
    expect(next.element.disabled).toBe(true)
    previous.element.focus()
    expect(document.activeElement).toBe(previous.element)
    await previous.trigger('click')
    expect(wrapper.get(`${prefix}__month`).text()).toBe('2024年11月')
    await wrapper.setProps({ selectedDate: '2023-12-31' })
    await next.trigger('click')
    expect(wrapper.get(`${prefix}__month`).text()).toBe('2024年1月')
    await previous.trigger('click')
    expect(wrapper.get(`${prefix}__month`).text()).toBe('2023年12月')
    await wrapper.get(`${prefix}__today-btn`).trigger('click')
    expect(wrapper.get(`${prefix}__month`).text()).toBe('2024年12月')
    expect(next.element.disabled).toBe(true)
    expect(wrapper.find(`${prefix}__today-btn`).exists()).toBe(false)
    expect(wrapper.emitted('select-date')).toBeUndefined()
  })
})

describe('朋友圈日历数据来源与不可用状态', () => {
  it('概览加载失败时显示未知数量，恢复后展示真实聚合', async () => {
    const wrapper = await mountCalendar('moment')
    await wrapper.setProps({ available: false })
    expect(wrapper.get('.moment-calendar-card__legend').text()).toBe('本月 — 条动态 · UTC')
    expect(wrapper.find('.has-moment').exists()).toBe(false)
    await wrapper.setProps({ available: true, dateCounts: { '2024-02-29': 4 } })
    expect(wrapper.get('.moment-calendar-card__legend').text()).toBe('本月 4 条动态 · UTC')
    expect(wrapper.get('.has-moment').attributes('aria-label')).toBe('2024-02-29，4 条动态')
  })

  it('兼容 ISO 日期列表重复计数，并优先采用概览聚合', async () => {
    const wrapper = await mountCalendar('moment')
    await wrapper.setProps({
      dateCounts: undefined,
      momentDates: ['2024-02-29T01:00:00Z', '2024-02-29T16:30:00Z', '2024-01-31T22:00:00Z'],
    })
    expect(wrapper.get('.moment-calendar-card__legend').text()).toContain('本月 2 条动态')
    await wrapper.setProps({ dateCounts: { '2024-02-29': 5 } })
    expect(wrapper.get('.moment-calendar-card__legend').text()).toContain('本月 5 条动态')
  })
})
