/**
 * @file datePicker.test.ts
 * @description 通用日期选择器：日期纯函数（解析、月历网格、跨月移动）与组件交互（打开聚焦、键盘移动、
 *              年月视图跳转、范围限制、Esc 关闭）
 * @author TixXin
 * @since 2026-10-20
 */
import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import DatePicker from '../../app/components/common/DatePicker.vue'
import { addDays, addMonths, monthGrid, parseIsoDate, toIsoDate, weekdayColumn } from '../../app/utils/calendarGrid'

describe('calendarGrid', () => {
  it('解析 YYYY-MM-DD，拒绝格式错误与不存在的日期', () => {
    expect(parseIsoDate('2026-10-20')).toEqual({ year: 2026, month: 9, day: 20 })
    for (const value of ['', '2026/10/20', '2026-02-30', '2026-13-01', '20261020'])
      expect(parseIsoDate(value)).toBeNull()
    expect(toIsoDate({ year: 987, month: 0, day: 5 })).toBe('0987-01-05')
  })

  it('月历固定 42 格，按周起始日对齐，并标出本月以外的日期', () => {
    // 2026-10-01 是周四
    const monday = monthGrid(2026, 9, 1)
    expect(monday).toHaveLength(42)
    expect(monday[0]!.iso).toBe('2026-09-28')
    expect(monday[3]).toMatchObject({ iso: '2026-10-01', inMonth: true })
    expect(monday[0]!.inMonth).toBe(false)
    const sunday = monthGrid(2026, 9, 0)
    expect(sunday[0]!.iso).toBe('2026-09-27')
    expect(sunday[4]!.iso).toBe('2026-10-01')
  })

  it('按天、按月移动可跨月跨年，月末日期按目标月份截断', () => {
    expect(toIsoDate(addDays({ year: 2026, month: 11, day: 31 }, 1))).toBe('2027-01-01')
    expect(toIsoDate(addMonths({ year: 2026, month: 2, day: 31 }, -1))).toBe('2026-02-28')
    expect(toIsoDate(addMonths({ year: 2024, month: 1, day: 29 }, 12))).toBe('2025-02-28')
    expect(weekdayColumn({ year: 2026, month: 9, day: 20 }, 1)).toBe(1)
    expect(weekdayColumn({ year: 2026, month: 9, day: 20 }, 0)).toBe(2)
  })
})

const mounted: { unmount: () => void }[] = []
afterEach(() => {
  for (const item of mounted.splice(0)) item.unmount()
})

async function mountPicker(props: Record<string, unknown>) {
  const host = document.body.appendChild(document.createElement('div'))
  const wrapper = await mountSuspended(DatePicker, { props, attachTo: host })
  mounted.push({
    unmount: () => {
      wrapper.unmount()
      host.remove()
    },
  })
  return wrapper
}

describe('CommonDatePicker', () => {
  it('打开后聚焦选中日期，方向键与 PageUp 移动光标，Enter（点击）选中并关闭', async () => {
    const wrapper = await mountPicker({ modelValue: '2026-10-20', id: 'launch' })
    expect(wrapper.find('#launch').text()).toBe('2026年10月20日')
    await wrapper.find('#launch').trigger('click')
    await flushPromises()
    expect(document.activeElement?.getAttribute('data-iso')).toBe('2026-10-20')
    const key = async (key: string, shiftKey = false) => {
      await wrapper.find('[data-iso]:focus').trigger('keydown', { key, shiftKey })
      await flushPromises()
    }
    await key('ArrowLeft')
    await key('ArrowUp')
    expect(document.activeElement?.getAttribute('data-iso')).toBe('2026-10-12')
    await key('PageUp')
    expect(document.activeElement?.getAttribute('data-iso')).toBe('2026-09-12')
    await key('Home')
    expect(document.activeElement?.getAttribute('data-iso')).toBe('2026-09-07')
    await wrapper.find('[data-iso="2026-09-07"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['2026-09-07']])
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('点标题依次进入月份与年份视图，选年选月后回到日视图', async () => {
    const wrapper = await mountPicker({ modelValue: '2026-10-20' })
    await wrapper.find('.date-picker__trigger').trigger('click')
    await flushPromises()
    await wrapper.find('.date-picker__title').trigger('click')
    expect(wrapper.find('.date-picker__title').text()).toBe('2026年')
    await wrapper.find('.date-picker__title').trigger('click')
    expect(wrapper.find('.date-picker__title').text()).toBe('2016 – 2027')
    await wrapper
      .findAll('.date-picker__cell')
      .find((cell) => cell.text() === '2019')!
      .trigger('click')
    await wrapper.findAll('.date-picker__cell')[2]!.trigger('click')
    await flushPromises()
    expect(wrapper.find('.date-picker__title').text()).toBe('2019年3月')
    expect(wrapper.find('[data-iso="2019-03-15"]').exists()).toBe(true)
  })

  it('超出范围的日期与「今天」不可选；Esc 关闭并把焦点还给触发按钮', async () => {
    const wrapper = await mountPicker({ modelValue: '2020-01-10', min: '2020-01-05', max: '2020-01-20' })
    await wrapper.find('.date-picker__trigger').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-iso="2020-01-04"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-iso="2020-01-21"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-iso="2020-01-05"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('.date-picker__today').attributes('disabled')).toBeDefined()
    await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(document.activeElement?.classList.contains('date-picker__trigger')).toBe(true)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
