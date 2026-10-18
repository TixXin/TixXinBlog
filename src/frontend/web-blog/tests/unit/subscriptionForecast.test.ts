/** @file subscriptionForecast.test.ts @description 续费预测覆盖币种精度、图表输入、逾期清单、动态切换和可读说明 */
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mockComponent, mountSuspended } from '@nuxt/test-utils/runtime'
import Forecast from '../../app/components/subscription/Forecast.vue'
import type { CurrencyStats, SubscriptionCurrency, SubscriptionStats } from '../../app/features/subscription/types'

// 直接替换 Nuxt 自动导入的组件，避免懒加载包装绕过普通组件替身。
mockComponent('SubscriptionChart', async () => {
  const { defineComponent, h } = await import('vue')
  return defineComponent({
    name: 'SubscriptionChartStub',
    props: ['kind', 'height', 'labels', 'values', 'formattedValues', 'currency', 'label'],
    setup: () => () => h('div'),
  })
})
const ChartStub = { name: 'SubscriptionChartStub' }
// 展开客户端插槽以核对图表输入，图表渲染器本身不在预测组件测试范围内。
const ClientOnlyStub = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h('div', slots.default?.()),
})
const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

function currencyStats(currency: SubscriptionCurrency, overrides: Partial<CurrencyStats> = {}): CurrencyStats {
  return {
    currency,
    count: 0,
    activeCount: 0,
    recurringCount: 0,
    annualAmount: 0,
    monthlyAmount: 0,
    oneTimeAmount: 0,
    categories: [],
    forecast: [],
    upcoming: [],
    ...overrides,
  }
}
function stats(currencies: CurrencyStats[]): SubscriptionStats {
  return {
    asOf: '2026-10-16',
    total: currencies.reduce((total, item) => total + item.count, 0),
    activeCount: currencies.reduce((total, item) => total + item.activeCount, 0),
    recurringCount: currencies.reduce((total, item) => total + item.recurringCount, 0),
    categoryCount: new Set(currencies.flatMap((item) => item.categories.map((category) => category.category))).size,
    currencies,
  }
}
async function setup(value: SubscriptionStats, currency: SubscriptionCurrency = 'USD') {
  const wrapper = await mountSuspended(Forecast, {
    props: { stats: value, currency },
    global: { stubs: { ClientOnly: ClientOnlyStub } },
  })
  wrappers.push(wrapper)
  return wrapper
}

describe('订阅续费预测抽屉', () => {
  it('扣费清单按日期升序排列，逾期记录保留原日期并给出核对提示', async () => {
    const wrapper = await setup(
      stats([
        currencyStats('USD', {
          count: 2,
          activeCount: 2,
          recurringCount: 2,
          monthlyAmount: 6500,
          annualAmount: 78000,
          categories: [
            { category: 'development', count: 1, annualAmount: 24000 },
            { category: 'design', count: 1, annualAmount: 54000 },
          ],
          forecast: [
            { month: '2026-10', amount: 2000 },
            { month: '2026-11', amount: 4500 },
          ],
          upcoming: [
            { id: 2, name: '设计素材库', date: '2026-11-02', amount: 4500, currency: 'USD', overdue: false },
            { id: 1, name: '云端工作台', date: '2026-09-28', amount: 2000, currency: 'USD', overdue: true },
          ],
        }),
      ]),
    )
    const rows = wrapper.findAll('.subscription-forecast__payments li')
    expect(rows.map((row) => row.get('div > strong').text())).toEqual(['云端工作台', '设计素材库'])
    expect(rows[0]!.text()).toContain('2026-09-28')
    expect(rows[0]!.text()).toContain('已逾期，请核对')
    expect(rows[1]!.text()).not.toContain('已逾期')
    expect(rows[0]!.text()).toContain('USD 20.00')
    expect(wrapper.text()).not.toContain('当前条件下没有非零续费预测')
  })

  it('当前币种没有统计时，预测与扣费清单分别说明为空且不渲染图表', async () => {
    const wrapper = await setup(
      stats([
        currencyStats('CNY', {
          count: 1,
          activeCount: 1,
          recurringCount: 1,
          monthlyAmount: 1000,
          annualAmount: 12000,
          categories: [{ category: 'cloud', count: 1, annualAmount: 12000 }],
          forecast: [{ month: '2026-10', amount: 1000 }],
        }),
      ]),
    )
    expect(wrapper.text()).toContain('当前筛选下没有 USD 订阅，暂无续费预测。')
    expect(wrapper.text()).toContain('当前筛选没有可用的扣费日期。')
    expect(wrapper.find('.subscription-forecast__amounts').exists()).toBe(false)
    expect(wrapper.findComponent(ChartStub).exists()).toBe(false)
  })

  it('有月份记录但预测金额全为零时保留图表并说明没有非零预测', async () => {
    const wrapper = await setup(
      stats([
        currencyStats('USD', {
          count: 1,
          activeCount: 1,
          recurringCount: 1,
          categories: [{ category: 'development', count: 1, annualAmount: 0 }],
          forecast: [
            { month: '2026-10', amount: 0 },
            { month: '2026-11', amount: 0 },
          ],
        }),
      ]),
    )
    expect(wrapper.text()).not.toContain('暂无续费预测')
    expect(wrapper.text()).toContain('当前条件下没有非零续费预测')
    expect(wrapper.findAll('.subscription-forecast__amounts li')).toHaveLength(2)
    expect(wrapper.getComponent(ChartStub).props('values')).toEqual([0, 0])
    expect(wrapper.text()).toContain('截至 2026-10-16')
  })

  it.each([
    { currency: 'USD', amount: 123456, display: '1,234.56', value: 1234.56 },
    { currency: 'JPY', amount: 123456, display: '123,456', value: 123456 },
  ] as const)(
    '$currency 文字明细和扣费清单保持币种精度，图表使用主要货币单位',
    async ({ currency, amount, display, value }) => {
      const wrapper = await setup(
        stats([
          currencyStats(currency, {
            count: 1,
            activeCount: 1,
            recurringCount: 1,
            monthlyAmount: amount,
            annualAmount: amount * 12,
            categories: [{ category: 'productivity', count: 1, annualAmount: amount * 12 }],
            forecast: [{ month: '2026-10', amount }],
            upcoming: [{ id: 1, name: '创作工具', date: '2026-10-20', amount, currency, overdue: false }],
          }),
        ]),
        currency,
      )
      expect(wrapper.get('section').attributes('aria-label')).toBe(`${currency}续费预测`)
      expect(wrapper.get('section').attributes('data-currency')).toBe(currency)
      expect(wrapper.get('.subscription-forecast__amounts li > strong').text()).toBe(`${currency} ${display}`)
      expect(wrapper.get('.subscription-forecast__payments li > strong').text()).toBe(`${currency} ${display}`)
      expect(wrapper.getComponent(ChartStub).props()).toMatchObject({
        kind: 'line',
        labels: ['2026-10'],
        values: [value],
        formattedValues: [display],
        currency,
        label: `${currency}未来12个月预计续费金额；文字明细可在下方展开`,
      })
    },
  )

  it('切换币种只展示对应预测和扣费清单，重新读取后移除旧逾期提示', async () => {
    const usd = currencyStats('USD', {
      count: 1,
      activeCount: 1,
      recurringCount: 1,
      monthlyAmount: 2000,
      annualAmount: 24000,
      categories: [{ category: 'development', count: 1, annualAmount: 24000 }],
      forecast: [{ month: '2026-10', amount: 2000 }],
      upcoming: [{ id: 1, name: '云端工作台', date: '2026-10-01', amount: 2000, currency: 'USD', overdue: true }],
    })
    const jpy = currencyStats('JPY', {
      count: 1,
      activeCount: 1,
      recurringCount: 1,
      monthlyAmount: 1500,
      annualAmount: 18000,
      categories: [{ category: 'education', count: 1, annualAmount: 18000 }],
      forecast: [{ month: '2026-11', amount: 1500 }],
      upcoming: [{ id: 2, name: '阅读服务', date: '2026-11-01', amount: 1500, currency: 'JPY', overdue: false }],
    })
    const wrapper = await setup(stats([jpy, usd]))
    expect(wrapper.get('.subscription-forecast__payments').text()).toContain('云端工作台')
    expect(wrapper.find('.subscription-forecast__overdue').exists()).toBe(true)

    await wrapper.setProps({ currency: 'JPY' })
    expect(wrapper.get('.subscription-forecast__payments').text()).toContain('阅读服务')
    expect(wrapper.text()).not.toContain('云端工作台')
    expect(wrapper.find('.subscription-forecast__overdue').exists()).toBe(false)
    expect(wrapper.getComponent(ChartStub).props()).toMatchObject({
      currency: 'JPY',
      labels: ['2026-11'],
      values: [1500],
    })

    await wrapper.setProps({ currency: 'USD' })
    expect(wrapper.find('.subscription-forecast__overdue').exists()).toBe(true)
    await wrapper.setProps({
      stats: stats([
        {
          ...usd,
          forecast: [{ month: '2026-11', amount: 2000 }],
          upcoming: [{ ...usd.upcoming[0]!, date: '2026-11-01', overdue: false }],
        },
      ]),
    })
    expect(wrapper.find('.subscription-forecast__overdue').exists()).toBe(false)
    expect(wrapper.get('.subscription-forecast__payments').text()).toContain('2026-11-01')
    expect(wrapper.get('.subscription-forecast__payments').text()).not.toContain('2026-10-01')
  })

  it('文字明细与预测说明使用原生折叠区，并保留 UTC 日期及提醒边界说明', async () => {
    const wrapper = await setup(stats([]))
    const disclosures = wrapper.findAll('details')
    expect(disclosures).toHaveLength(2)
    expect(disclosures.map((details) => details.get('summary').text())).toEqual([
      '查看预计续费文字明细',
      '预测与扣费说明',
    ])
    expect(disclosures.every((details) => details.attributes('open') === undefined)).toBe(true)
    expect(disclosures[0]!.text()).toContain('暂无可展示的月份记录。')
    expect(disclosures[1]!.text()).toContain('截至 2026-10-16（UTC 日期）')
    expect(disclosures[1]!.text()).toContain('并非实际历史支出')
    expect(disclosures[1]!.text()).toContain('试用、暂停、取消和过期记录不生成续费预测')
    expect(disclosures[1]!.text()).toContain('缺少可靠日期的记录不会猜测扣款时间')
    expect(disclosures[1]!.text()).toContain('不会自动扣款或发送通知')
  })
})
