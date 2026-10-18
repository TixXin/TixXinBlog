/** @file subscriptionHistory.test.ts @description 价格历史原币种显示、只读列表及按币种和周期分段的懒加载图表 */
import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockComponent, mountSuspended } from '@nuxt/test-utils/runtime'
import History from '../../app/components/subscription/History.vue'
import type { SubscriptionCurrency, SubscriptionPrice } from '../../app/features/subscription/types'

const wrappers: { unmount(): void }[] = []
const Chart = { name: 'SubscriptionChartStub' }
// 仅替换客户端图表渲染边界，历史格式、分段和原生展开事件均使用真实组件。
mockComponent('SubscriptionChart', async () => {
  const { defineComponent, h } = await import('vue')
  return defineComponent({
    name: 'SubscriptionChartStub',
    props: { kind: String, labels: Array, values: Array, currency: String, step: Boolean, label: String },
    setup: (props) => () => h('div', { role: 'img', 'aria-label': props.label }),
  })
})

afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

function entry(id: string, overrides: Partial<SubscriptionPrice> = {}): SubscriptionPrice {
  return {
    id,
    amount: 2000,
    currency: 'USD',
    billingCycle: 'monthly',
    effectiveAt: '2026-01-01T00:00:00.000Z',
    recordedAt: overrides.effectiveAt ?? '2026-01-02T08:30:00Z',
    ...overrides,
  }
}

async function setup(history: SubscriptionPrice[]) {
  const wrapper = await mountSuspended(History, {
    props: { history },
  })
  wrappers.push(wrapper)
  return wrapper
}

describe('订阅价格历史组件', () => {
  it.each<{ currency: SubscriptionCurrency; amount: number; expected: string }>([
    { currency: 'USD', amount: 2501, expected: 'USD 25.01' },
    { currency: 'CNY', amount: 120005, expected: 'CNY 1,200.05' },
    { currency: 'EUR', amount: 500, expected: 'EUR 5.00' },
    { currency: 'GBP', amount: 0, expected: 'GBP 0.00' },
    { currency: 'JPY', amount: 1234, expected: 'JPY 1,234' },
    { currency: 'HKD', amount: 999, expected: 'HKD 9.99' },
    { currency: 'TWD', amount: 5000, expected: 'TWD 50.00' },
  ])('$currency 历史按原币种的最小货币单位格式化', async ({ currency, amount, expected }) => {
    const wrapper = await setup([entry('initial', { currency, amount })])
    expect(wrapper.get('ol li strong').text()).toBe(`初始记录：${expected} / 月付`)
    expect(wrapper.get('summary').text()).toBe('价格历史（1 条）')
    expect(wrapper.findAllComponents(Chart)).toHaveLength(0)
  })

  it('只读列表保留初始价格、后续变价、UTC 时间和原因，不把未知旧价格补成记录', async () => {
    const wrapper = await setup([
      entry('initial'),
      entry('changed', {
        amount: 2500,
        billingCycle: 'yearly',
        effectiveAt: '2026-02-01T00:00:00.000Z',
        recordedAt: '2026-02-02T12:00:00.000Z',
        reason: '升级创作套餐',
      }),
    ])
    const rows = wrapper.findAll('ol li')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.get('strong').text()).toBe('初始记录：USD 20.00 / 月付')
    expect(rows[0]!.findAll('p')).toHaveLength(1)
    expect(rows[0]!.get('p').text()).toBe('生效 2026-01-01 00:00:00 UTC · 记录 2026-01-02 08:30:00 UTC')
    expect(rows[1]!.get('strong').text()).toBe('价格变更：USD 25.00 / 年付')
    expect(rows[1]!.findAll('p').map((paragraph) => paragraph.text())).toEqual([
      '生效 2026-02-01 00:00:00 UTC · 记录 2026-02-02 12:00:00 UTC',
      '升级创作套餐',
    ])
    expect(wrapper.text()).toContain('首次录入之前的价格未知；变更币种或周期会分段展示。')
    expect(wrapper.find('input, select, textarea, button').exists()).toBe(false)
  })

  it('原生详情展开后才加载图表，币种或周期变化分段，返回旧币种也不跨段合并', async () => {
    const history = [
      entry('usd-first'),
      entry('usd-second', { amount: 2555, effectiveAt: '2026-02-01T00:00:00Z' }),
      entry('jpy-first', { currency: 'JPY', amount: 1200, effectiveAt: '2026-03-01T00:00:00Z' }),
      entry('jpy-yearly', {
        currency: 'JPY',
        amount: 12000,
        billingCycle: 'yearly',
        effectiveAt: '2026-04-01T00:00:00Z',
      }),
      entry('usd-return', { amount: 3000, effectiveAt: '2026-05-01T00:00:00Z' }),
    ]
    const original = structuredClone(history)
    const wrapper = await setup(history)
    const details = wrapper.get<HTMLDetailsElement>('details')
    expect(details.element.open).toBe(false)
    expect(details.element.firstElementChild?.tagName).toBe('SUMMARY')
    expect(wrapper.findAll('ol li')).toHaveLength(5)
    expect(wrapper.findAllComponents(Chart)).toHaveLength(0)
    // happy-dom 不模拟键盘默认动作；直接驱动原生 details 的 open 与 toggle 契约。
    details.element.open = true
    await details.trigger('toggle')
    await flushPromises()
    expect(wrapper.findAll('h3').map((heading) => heading.text())).toEqual([
      'USD · 月付 · 第 1 段',
      'JPY · 月付 · 第 2 段',
      'JPY · 年付 · 第 3 段',
      'USD · 月付 · 第 4 段',
    ])
    const charts = wrapper.findAllComponents(Chart)
    expect(charts).toHaveLength(4)
    expect(charts.map((chart) => chart.props('values'))).toEqual([[20, 25.55], [1200], [12000], [30]])
    expect(charts.map((chart) => chart.props('currency'))).toEqual(['USD', 'JPY', 'JPY', 'USD'])
    expect(charts[0]!.props('labels')).toEqual(['2026-01-01 00:00:00 UTC', '2026-02-01 00:00:00 UTC'])
    expect(charts[2]!.props('label')).toBe('JPY 年付价格历史阶梯图')
    for (const chart of charts) {
      expect(chart.props('kind')).toBe('line')
      expect(chart.props('step')).toBe(true)
      expect(chart.attributes('aria-label')).toBe(chart.props('label'))
    }
    expect(history).toEqual(original)
    details.element.open = false
    await details.trigger('toggle')
    expect(wrapper.findAllComponents(Chart)).toHaveLength(0)
    expect(wrapper.findAll('ol li')).toHaveLength(5)
  })

  it('空历史显示零条，展开时不制造价格段或图表', async () => {
    const wrapper = await setup([])
    expect(wrapper.get('summary').text()).toBe('价格历史（0 条）')
    expect(wrapper.findAll('ol li')).toHaveLength(0)
    const details = wrapper.get<HTMLDetailsElement>('details')
    details.element.open = true
    await details.trigger('toggle')
    expect(wrapper.findAll('h3')).toHaveLength(0)
    expect(wrapper.findAllComponents(Chart)).toHaveLength(0)
  })

  it('展开期间替换历史后同步更新条数、金额与币种分段', async () => {
    const wrapper = await setup([entry('initial')])
    const details = wrapper.get<HTMLDetailsElement>('details')
    details.element.open = true
    await details.trigger('toggle')
    await wrapper.setProps({
      history: [entry('replacement', { currency: 'JPY', amount: 6500, billingCycle: 'lifetime' })],
    })
    await flushPromises()
    expect(wrapper.get('summary').text()).toBe('价格历史（1 条）')
    expect(wrapper.get('ol li strong').text()).toBe('初始记录：JPY 6,500 / 买断')
    expect(wrapper.get('h3').text()).toBe('JPY · 买断 · 第 1 段')
    expect(wrapper.getComponent(Chart).props('values')).toEqual([6500])
    expect(wrapper.getComponent(Chart).props('currency')).toBe('JPY')
    expect(wrapper.text()).not.toContain('USD')
  })
})
