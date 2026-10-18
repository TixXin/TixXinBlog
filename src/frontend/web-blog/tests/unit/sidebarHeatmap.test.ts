/**
 * @file sidebarHeatmap.test.ts
 * @description 侧栏热力图的空数据、UTC 星期、活动分级和键盘焦点回归
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import HeatmapGrid from '../../app/components/sidebar/HeatmapGrid.vue'

const wrappers: { unmount(): void }[] = []
const hosts: HTMLElement[] = []
type Activity = { date: string; articles: number; comments: number }

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  hosts.splice(0).forEach((host) => host.remove())
})

async function setup(activity: Activity[] = []) {
  const host = document.createElement('div')
  document.body.append(host)
  hosts.push(host)
  const wrapper = mount(HeatmapGrid, { props: { activity }, attachTo: host })
  wrappers.push(wrapper)
  return wrapper
}

function activityDays(count: number): Activity[] {
  return Array.from({ length: count }, (_, index) => ({
    date: `2026-01-${String(index + 1).padStart(2, '0')}`,
    articles: 1,
    comments: 0,
  }))
}

function tooltip() {
  return document.body.querySelector<HTMLElement>('.heatmap-tooltip')!
}

describe('侧栏热力图', () => {
  it('空数据不生成样本日期，仍提供 UTC 说明与方向键操作名称', async () => {
    const wrapper = await setup()
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe('每日公开内容，方向键选择日期')
    expect(wrapper.text()).toContain('最近 15 周 · UTC')
    expect(wrapper.findAll('.heatmap__legend-dot')).toHaveLength(5)
    expect(tooltip().style.opacity).toBe('0')
  })

  it('公开文章和评论共同决定五档颜色，读屏名称保留各自计数', async () => {
    const totals = [0, 1, 2, 3, 5, 6, 10, 11]
    const levels = [0, 1, 1, 2, 2, 3, 3, 4]
    const wrapper = await setup(
      totals.map((total, index) => ({
        date: `2026-01-${String(index + 1).padStart(2, '0')}`,
        articles: Math.min(total, 1),
        comments: Math.max(total - 1, 0),
      })),
    )
    wrapper.findAll('button').forEach((button, index) => {
      expect(button.attributes('style')).toContain(`var(--heatmap-${levels[index]})`)
      expect(button.attributes('aria-label')).toBe(
        `2026-01-${String(index + 1).padStart(2, '0')}，${Math.min(totals[index]!, 1)} 篇公开文章，${Math.max(totals[index]! - 1, 0)} 条公开评论`,
      )
    })
  })

  it.each([
    ['2024-02-29', '周四'],
    ['2025-12-31', '周三'],
    ['2026-01-01', '周四'],
    ['2026-01-04', '周日'],
    ['2026-01-05', '周一'],
  ])('键盘聚焦 %s 时按 UTC 显示 %s，失焦后收起提示', async (date, weekday) => {
    const wrapper = await setup([{ date, articles: 2, comments: 3 }])
    const button = wrapper.get('button')
    button.element.focus()
    await nextTick()
    expect(document.activeElement).toBe(button.element)
    expect(tooltip().style.opacity).toBe('1')
    expect(tooltip().textContent).toContain(`${date} ${weekday}`)
    expect(tooltip().textContent).toContain('发布 2 篇文章，3 条评论')
    button.element.blur()
    await nextTick()
    expect(tooltip().style.opacity).toBe('0')
  })

  it('鼠标提示区分零活动和纯评论，并在离开后隐藏', async () => {
    const wrapper = await setup([
      { date: '2026-01-01', articles: 0, comments: 0 },
      { date: '2026-01-02', articles: 0, comments: 2 },
    ])
    const buttons = wrapper.findAll('button')
    await buttons[0]!.trigger('mouseover')
    expect(tooltip().textContent).toContain('无活动')
    expect(tooltip().textContent).not.toContain('公开内容数量')
    await buttons[0]!.trigger('mouseout')
    expect(tooltip().style.opacity).toBe('0')
    await buttons[1]!.trigger('mouseover')
    expect(tooltip().textContent).toContain('2 条评论')
    expect(tooltip().textContent).not.toContain('发布')
  })

  it('方向键按日或周移动并限制在首尾，始终只有一个 Tab 入口', async () => {
    const wrapper = await setup(activityDays(15))
    const buttons = wrapper.findAll('button')
    buttons[0]!.element.focus()
    await nextTick()
    const moves = [
      [0, 'ArrowUp', 0],
      [0, 'ArrowDown', 1],
      [1, 'ArrowRight', 8],
      [8, 'ArrowLeft', 1],
      [1, 'ArrowLeft', 0],
      [0, 'ArrowRight', 7],
      [7, 'ArrowRight', 14],
      [14, 'ArrowDown', 14],
    ] as const
    for (const [from, key, to] of moves) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      buttons[from]!.element.dispatchEvent(event)
      await nextTick()
      expect(event.defaultPrevented).toBe(true)
      expect(document.activeElement).toBe(buttons[to]!.element)
      expect(wrapper.findAll('button[tabindex="0"]')).toHaveLength(1)
      expect(buttons[to]!.attributes('tabindex')).toBe('0')
    }
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    buttons[14]!.element.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(false)
  })

  it('数据缩短或清空后重新加载，仍保留可由 Tab 进入的日期', async () => {
    const wrapper = await setup(activityDays(15))
    wrapper.findAll('button')[14]!.element.focus()
    await nextTick()
    await wrapper.setProps({ activity: activityDays(2) })
    expect(wrapper.findAll('button[tabindex="0"]')).toHaveLength(1)
    expect(wrapper.findAll('button')[1]!.attributes('tabindex')).toBe('0')
    await wrapper.setProps({ activity: [] })
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(tooltip().style.opacity).toBe('0')
    await wrapper.setProps({ activity: activityDays(3) })
    expect(wrapper.findAll('button[tabindex="0"]')).toHaveLength(1)
    expect(wrapper.findAll('button')[0]!.attributes('tabindex')).toBe('0')
  })

  it('卸载时移除传送到 body 的提示节点', async () => {
    const wrapper = await setup(activityDays(1))
    wrapper.get('button').element.focus()
    await nextTick()
    expect(tooltip()).not.toBeNull()
    wrapper.unmount()
    wrappers.pop()
    expect(document.body.querySelector('.heatmap-tooltip')).toBeNull()
  })
})
