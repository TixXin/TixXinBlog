/**
 * @file datePicker.test.ts
 * @description 通用日期选择器：日期纯函数（解析、月历网格、跨月移动）与组件交互（打开聚焦、键盘移动、
 *              年月视图跳转、范围限制、Esc 关闭）
 * @author TixXin
 * @since 2026-10-20
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import DatePicker from '../../app/components/common/DatePicker.vue'
import {
  addDays,
  addMonths,
  monthGrid,
  parseIsoDate,
  parseTypedDate,
  toIsoDate,
  weekdayColumn,
} from '../../app/utils/calendarGrid'

describe('calendarGrid', () => {
  it('解析 YYYY-MM-DD，拒绝格式错误与不存在的日期', () => {
    expect(parseIsoDate('2026-10-20')).toEqual({ year: 2026, month: 9, day: 20 })
    for (const value of ['', '2026/10/20', '2026-02-30', '2026-13-01', '20261020'])
      expect(parseIsoDate(value)).toBeNull()
    expect(toIsoDate({ year: 987, month: 0, day: 5 })).toBe('0987-01-05')
  })

  it('手动输入接受常见分隔符与紧凑写法', () => {
    for (const value of ['2019-03-15', '2019/3/15', '2019.03.15', ' 2019 3 15 ', '20190315'])
      expect(parseTypedDate(value)).toEqual({ year: 2019, month: 2, day: 15 })
    for (const value of ['', '2019-3', '19-03-15', '2019-02-30', '2019/13/01']) expect(parseTypedDate(value)).toBeNull()
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
  it('日历按钮打开后聚焦选中日期，方向键与 PageUp 移动光标，点击选中并关闭', async () => {
    const wrapper = await mountPicker({ modelValue: '2026-10-20', id: 'launch' })
    expect((wrapper.find('#launch').element as HTMLInputElement).value).toBe('2026年10月20日')
    await wrapper.find('.date-picker__toggle').trigger('click')
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
    await wrapper.find('.date-picker__toggle').trigger('click')
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

  it('面板默认与输入框起始边对齐，右侧放不下时与右缘对齐，窄屏时贴视口边缘', async () => {
    const width = vi.spyOn(window, 'innerWidth', 'get')
    const wrapper = await mountPicker({ modelValue: '2026-10-20' })
    const trigger = wrapper.find('.date-picker__toggle')
    const open = async (left: number, triggerWidth: number, viewport: number) => {
      width.mockReturnValue(viewport)
      vi.spyOn(wrapper.find('.date-picker').element, 'getBoundingClientRect').mockReturnValue({
        left,
        right: left + triggerWidth,
        width: triggerWidth,
        top: 100,
        bottom: 144,
        height: 44,
        x: left,
        y: 100,
        toJSON: () => ({}),
      })
      await trigger.trigger('click')
      await flushPromises()
      // 上一次关闭的面板可能仍在离场过渡中，取最新打开的那个
      const style = (wrapper.findAll('.date-picker__popover').at(-1)!.element as HTMLElement).style.left
      await trigger.trigger('click')
      await flushPromises()
      return style
    }
    // 空间充足：起始边对齐
    expect(await open(100, 400, 1440)).toBe('0px')
    // 靠右：输入框 1200–1400px，左对齐会超出 1432px 的安全线，改为右缘对齐（200 - 296）
    expect(await open(1200, 200, 1440)).toBe('-96px')
    // 320 宽窄屏、输入框 100–300px：右对齐会越过左侧 8px 安全线，改为贴左边缘（8 - 100），面板落在 8–304px
    expect(await open(100, 200, 320)).toBe('-92px')
    width.mockRestore()
  })

  it('超出范围的日期与「今天」不可选；Esc 关闭并把焦点还给输入框', async () => {
    const wrapper = await mountPicker({ modelValue: '2020-01-10', min: '2020-01-05', max: '2020-01-20' })
    await wrapper.find('.date-picker__toggle').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-iso="2020-01-04"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-iso="2020-01-21"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-iso="2020-01-05"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('.date-picker__today').attributes('disabled')).toBeDefined()
    await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(document.activeElement?.classList.contains('date-picker__input')).toBe(true)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('clearable 时可清空并同时发出 change', async () => {
    const wrapper = await mountPicker({ modelValue: '2026-10-20', clearable: true })
    await wrapper.find('.date-picker__toggle').trigger('click')
    await flushPromises()
    await wrapper.find('.date-picker__clear').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['']])
    expect(wrapper.emitted('change')).toEqual([['']])
  })

  it('点输入框打开面板且焦点留在输入框，输入合法日期时面板跟随，↓ 把焦点交给面板', async () => {
    const wrapper = await mountPicker({ modelValue: '2026-10-20' })
    const input = wrapper.find('.date-picker__input')
    await input.trigger('focus')
    await input.trigger('click')
    await flushPromises()
    expect((input.element as HTMLInputElement).value).toBe('2026-10-20')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    await input.setValue('2019/3/15')
    await flushPromises()
    expect(wrapper.find('.date-picker__title').text()).toBe('2019年3月')
    await input.trigger('keydown', { key: 'ArrowDown' })
    await flushPromises()
    expect(document.activeElement?.getAttribute('data-iso')).toBe('2019-03-15')
  })

  it('手动输入：回车或失焦确认并写入 ISO 日期；回车不提交外层表单', async () => {
    const wrapper = await mountPicker({ modelValue: '2026-10-20' })
    const input = wrapper.find('.date-picker__input')
    await input.trigger('focus')
    await input.setValue('20190315')
    const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true })
    input.element.dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(true)
    expect(wrapper.emitted('update:modelValue')).toEqual([['2019-03-15']])
    await input.setValue('2020.1.2')
    await input.trigger('blur')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['2020-01-02'])
    expect(wrapper.emitted('change')).toHaveLength(2)
  })

  it('不存在或超出范围的输入恢复原值并标为无效；可清空时清空输入即清除', async () => {
    const wrapper = await mountPicker({ modelValue: '2020-01-10', max: '2020-01-20', clearable: true })
    const input = wrapper.find('.date-picker__input')
    for (const value of ['2020-02-30', '2020-01-25', 'abc']) {
      await input.trigger('focus')
      await input.setValue(value)
      await input.trigger('blur')
      expect(input.attributes('aria-invalid')).toBe('true')
      expect((input.element as HTMLInputElement).value).toBe('2020年1月10日')
    }
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await input.trigger('focus')
    await input.setValue('')
    await input.trigger('blur')
    expect(wrapper.emitted('update:modelValue')).toEqual([['']])
    expect(input.attributes('aria-invalid')).toBeUndefined()
  })
})
