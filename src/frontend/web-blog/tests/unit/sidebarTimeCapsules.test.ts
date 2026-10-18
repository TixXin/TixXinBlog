/**
 * @file sidebarTimeCapsules.test.ts
 * @description 侧栏时间胶囊覆盖空态、UTC 回顾、原生交互、候选更新与随机切换
 */
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FlashTimeCapsuleCard from '../../app/components/sidebar/FlashTimeCapsuleCard.vue'
import MomentTimeCapsuleCard from '../../app/components/sidebar/MomentTimeCapsuleCard.vue'
import type { FlashRecollection } from '../../app/features/flash/types'
import type { MomentItem } from '../../app/features/moment/types'

type MomentRecollection = Pick<MomentItem, 'id' | 'content' | 'date'>
const mounted: { wrapper: VueWrapper; host: HTMLElement }[] = []
const NuxtLink = defineComponent({
  props: { to: { type: String, required: true } },
  setup:
    (props, { slots }) =>
    () =>
      h('a', { href: props.to }, slots.default?.()),
})

function mountCapsule(
  kind: 'moment' | 'flash',
  records: MomentRecollection[],
  onThisDay: FlashRecollection | null = null,
) {
  const host = document.createElement('div')
  document.body.append(host)
  const options = { attachTo: host, global: { stubs: { Icon: true, NuxtLink } } }
  const wrapper =
    kind === 'moment'
      ? mount(MomentTimeCapsuleCard, { ...options, props: { moments: records } })
      : mount(FlashTimeCapsuleCard, {
          ...options,
          props: { recollections: records.map(({ date, ...record }) => ({ ...record, createdAt: date })), onThisDay },
        })
  mounted.push({ wrapper, host })
  return wrapper
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2024-03-01T00:30:00+08:00'))
  vi.spyOn(Math, 'random').mockReturnValue(0)
})

afterEach(() => {
  mounted.splice(0).forEach(({ wrapper, host }) => {
    wrapper.unmount()
    host.remove()
  })
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const records: MomentRecollection[] = [
  { id: 'first', content: '山间清晨', date: '2022-02-01T23:30:00Z' },
  { id: 'second', content: '河边夜色', date: '2022-03-01T08:30:00Z' },
  { id: 'third', content: '雨后小路', date: '2022-04-01T12:30:00Z' },
]

describe.each<'moment' | 'flash'>(['moment', 'flash'])('%s 时间胶囊', (kind) => {
  const prefix = `.${kind}-capsule-card`
  const route = kind === 'moment' ? 'moments' : 'flash'

  it('空数据不渲染卡片或伪造回顾', async () => {
    const wrapper = await mountCapsule(kind, [])
    expect(wrapper.find('section').exists()).toBe(false)
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('原生换一条按钮可聚焦，抽到当前项时切换到下一项并保留焦点', async () => {
    const wrapper = await mountCapsule(kind, records)
    const refresh = wrapper.get<HTMLButtonElement>('button[aria-label="换一条"]')
    expect(wrapper.get('a').attributes('href')).toBe(`/${route}/first`)
    expect(refresh.element).toBeInstanceOf(HTMLButtonElement)
    expect(refresh.attributes('type')).toBe('button')
    expect(refresh.element.tabIndex).toBe(0)
    refresh.element.focus()
    expect(document.activeElement).toBe(refresh.element)
    refresh.element.click()
    await nextTick()
    expect(wrapper.get('a').attributes('href')).toBe(`/${route}/second`)
    expect(document.activeElement).toBe(refresh.element)
    vi.mocked(Math.random).mockReturnValue(0.99)
    refresh.element.click()
    await nextTick()
    expect(wrapper.get('a').attributes('href')).toBe(`/${route}/third`)
    refresh.element.click()
    await nextTick()
    expect(wrapper.get('a').attributes('href')).toBe(`/${route}/first`)
    const link = wrapper.get<HTMLAnchorElement>('a')
    expect(link.element.tabIndex).toBe(0)
    link.element.focus()
    expect(document.activeElement).toBe(link.element)
  })

  it('只有一项时刷新保持原项且不消耗随机数', async () => {
    const wrapper = await mountCapsule(kind, records.slice(0, 1))
    vi.mocked(Math.random).mockClear()
    await wrapper.get('button[aria-label="换一条"]').trigger('click')
    expect(wrapper.get('a').attributes('href')).toBe(`/${route}/first`)
    expect(Math.random).not.toHaveBeenCalled()
  })

  it('候选缩短或清空后不残留旧条目', async () => {
    const wrapper = await mountCapsule(kind, records)
    vi.mocked(Math.random).mockReturnValue(0.99)
    await wrapper.get('button[aria-label="换一条"]').trigger('click')
    expect(wrapper.get('a').attributes('href')).toBe(`/${route}/third`)
    const remaining = [{ id: 'replacement', content: '新读取的回顾', date: '2024-01-01T00:00:00Z' }]
    await wrapper.setProps(
      kind === 'moment'
        ? { moments: remaining }
        : { recollections: remaining.map(({ date, ...record }) => ({ ...record, createdAt: date })) },
    )
    expect(wrapper.get('a').attributes('href')).toBe(`/${route}/replacement`)
    await wrapper.setProps(kind === 'moment' ? { moments: [] } : { recollections: [] })
    expect(wrapper.find('section').exists()).toBe(false)
  })

  it('文本压缩空白并限制摘录长度，日期按 UTC 展示', async () => {
    const wrapper = await mountCapsule(kind, [
      { id: 'long', content: `雨后\n\t小路 ${'风'.repeat(70)}`, date: '2023-01-01T00:30:00+08:00' },
    ])
    expect(wrapper.get(`${prefix}__excerpt`).text()).toBe(`${`雨后 小路 ${'风'.repeat(70)}`.slice(0, 60)}…`)
    expect(wrapper.get(`${prefix}__meta`).text()).toBe('2022-12-31')
  })
})

describe('朋友圈去年今日', () => {
  it('使用 UTC 月日而非本地日期，并选出去年同日较晚的记录', async () => {
    vi.setSystemTime(new Date('2025-01-01T00:30:00+08:00'))
    const wrapper = await mountCapsule('moment', [
      { id: 'wrong-day', content: '本地新年', date: '2024-01-01T00:00:00Z' },
      { id: 'older-year', content: '更早的一年', date: '2022-12-31T23:00:00Z' },
      { id: 'early', content: '去年清晨', date: '2023-12-31T00:00:00Z' },
      { id: 'late', content: '去年深夜', date: '2023-12-31T23:30:00Z' },
      { id: 'this-year', content: '今年今日', date: '2024-12-31T01:00:00Z' },
    ])
    const block = wrapper.get('.moment-capsule-card__block')
    expect(block.text()).toContain('去年今日')
    expect(block.get('a').attributes('href')).toBe('/moments/late')
  })

  it('闰年二月二十九日不把去年二月二十八日视为同一天', async () => {
    const wrapper = await mountCapsule('moment', [
      { id: 'february', content: '去年二月末', date: '2023-02-28T23:30:00Z' },
      { id: 'march', content: '去年三月初', date: '2023-03-01T00:30:00Z' },
    ])
    expect(wrapper.text()).not.toContain('去年今日')
    expect(wrapper.findAll('.moment-capsule-card__block')).toHaveLength(1)
  })
})

describe('闪念概览回顾', () => {
  it('只有往年今日也展示服务端给定内容，清空概览后隐藏', async () => {
    const wrapper = await mountCapsule('flash', [], {
      id: 'leap',
      content: '上个闰年的今天',
      createdAt: '2020-02-29T23:30:00Z',
    })
    expect(wrapper.get('a').attributes('href')).toBe('/flash/leap')
    expect(wrapper.get('.flash-capsule-card__meta').text()).toBe('2020-02-29')
    expect(wrapper.find('button').exists()).toBe(false)
    await wrapper.setProps({ onThisDay: null })
    expect(wrapper.find('section').exists()).toBe(false)
  })
})
