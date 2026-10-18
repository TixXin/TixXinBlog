/** @file subscriptionStats.test.ts @description 订阅预算覆盖原币种金额、分类排序、空状态及可访问的统计口径 */
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mockComponent, mountSuspended } from '@nuxt/test-utils/runtime'
import Stats from '../../app/components/subscription/Stats.vue'
import type { CurrencyStats, SubscriptionCurrency, SubscriptionStats } from '../../app/features/subscription/types'

// 直接替换 Nuxt 自动导入的组件，使懒加载包装也使用同一个图表替身。
mockComponent('SubscriptionChart', async () => {
  const { defineComponent, h } = await import('vue')
  return defineComponent({
    name: 'SubscriptionChartStub',
    props: {
      kind: String,
      horizontal: Boolean,
      height: Number,
      labels: Array,
      values: Array,
      formattedValues: Array,
      currency: String,
      label: String,
    },
    setup: () => () => h('div'),
  })
})
const ChartStub = { name: 'SubscriptionChartStub' }
// 展开客户端插槽，只替换图表渲染器，保留统计组件向图表传入的数据契约。
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
  const wrapper = await mountSuspended(Stats, {
    props: { stats: value, currency },
    global: { stubs: { ClientOnly: ClientOnlyStub } },
  })
  wrappers.push(wrapper)
  return wrapper
}

describe('订阅费用统计', () => {
  it.each([
    { currency: 'CNY', number: '1,234.56', annual: '14,814.72' },
    { currency: 'USD', number: '1,234.56', annual: '14,814.72' },
    { currency: 'EUR', number: '1,234.56', annual: '14,814.72' },
    { currency: 'GBP', number: '1,234.56', annual: '14,814.72' },
    { currency: 'JPY', number: '123,456', annual: '1,481,472' },
    { currency: 'HKD', number: '1,234.56', annual: '14,814.72' },
    { currency: 'TWD', number: '1,234.56', annual: '14,814.72' },
  ] as const)('$currency 预算按原币种精度和千位分组显示，并保留读屏金额', async ({ currency, number, annual }) => {
    const wrapper = await setup(
      stats([
        currencyStats(currency, {
          count: 3,
          activeCount: 2,
          recurringCount: 2,
          monthlyAmount: 123456,
          annualAmount: 1481472,
          categories: [{ category: 'development', count: 3, annualAmount: 1481472 }],
        }),
      ]),
      currency,
    )
    expect(wrapper.get('section').attributes('data-currency')).toBe(currency)
    expect(wrapper.get('h2').text()).toBe(`${currency} 月均预算`)
    expect(wrapper.get('.subscription-budget__amount strong').text()).toBe(number)
    expect(wrapper.get('.subscription-budget__amount').attributes('aria-label')).toBe(`${currency} ${number} 每月预算`)
    expect(wrapper.get('.subscription-budget__annual').text()).toContain(`年化 ${currency} ${annual}`)
    expect(wrapper.get('.subscription-budget__annual').text()).toContain('2 项持续订阅')
  })

  it('分类按年化金额降序展示，图表仅包含正费用且不改写传入分类', async () => {
    const selected = currencyStats('USD', {
      count: 4,
      activeCount: 3,
      recurringCount: 3,
      annualAmount: 123500,
      monthlyAmount: 10292,
      categories: [
        { category: 'cloud', count: 1, annualAmount: 44 },
        { category: 'other', count: 1, annualAmount: 0 },
        { category: 'development', count: 2, annualAmount: 123456 },
      ],
    })
    const originalCategories = structuredClone(selected.categories)
    const wrapper = await setup(
      stats([
        currencyStats('JPY', {
          count: 1,
          activeCount: 1,
          recurringCount: 1,
          monthlyAmount: 9000,
          annualAmount: 108000,
          categories: [{ category: 'cloud', count: 1, annualAmount: 108000 }],
        }),
        selected,
      ]),
    )
    const rows = wrapper.findAll('.subscription-breakdown__list li')
    expect(rows.map((row) => row.get('span').text())).toEqual(['开发工具2 条记录', '云服务1 条记录', '其他1 条记录'])
    expect(rows.map((row) => row.get('strong').text())).toEqual(['USD 1,234.56 / 年', 'USD 0.44 / 年', 'USD 0.00 / 年'])
    expect(wrapper.getComponent(ChartStub).props()).toMatchObject({
      kind: 'bar',
      horizontal: true,
      labels: ['开发工具', '云服务'],
      values: [1234.56, 0.44],
      formattedValues: ['1,234.56', '0.44'],
      currency: 'USD',
      label: 'USD分类年化费用横向条形图；完整金额可在分类明细中阅读',
    })
    expect(selected.categories).toEqual(originalCategories)
  })

  it('统计口径默认收起，按钮展开区域与读屏关联完整并可再次收起', async () => {
    const wrapper = await setup(
      stats([
        currencyStats('USD', {
          count: 2,
          activeCount: 2,
          oneTimeAmount: 9900,
          categories: [{ category: 'design', count: 2, annualAmount: 0 }],
        }),
        currencyStats('JPY', {
          count: 3,
          activeCount: 3,
          oneTimeAmount: 12345,
          categories: [{ category: 'education', count: 3, annualAmount: 0 }],
        }),
      ]),
      'JPY',
    )
    const button = wrapper.get('button[aria-label="查看预算统计口径"]')
    expect(button.attributes('type')).toBe('button')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[role="region"]').exists()).toBe(false)
    expect(wrapper.get('details').attributes('open')).toBeUndefined()

    await button.trigger('click')
    const region = wrapper.get('[role="region"][aria-label="预算统计口径"]')
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(button.attributes('aria-controls')).toBe(region.attributes('id'))
    expect(region.text()).toContain('统计截至 2026-10-16（UTC 日期）')
    expect(region.text()).toContain('JPY 订阅，共 3 条')
    expect(region.text()).toContain('不同币种分别计算，不做汇率换算')
    expect(region.text()).toContain('暂停、取消、试用、过期和未来开始的记录不计入当前预算')
    expect(region.text()).toContain('JPY 12,345，不代表已支付总额')
    expect(region.text()).not.toContain('99.00')

    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[role="region"]').exists()).toBe(false)
  })

  it('切换币种和重新读取统计时同步更新预算、分类与图表', async () => {
    const wrapper = await setup(
      stats([
        currencyStats('USD', {
          count: 1,
          activeCount: 1,
          recurringCount: 1,
          monthlyAmount: 2501,
          annualAmount: 30012,
          categories: [{ category: 'development', count: 1, annualAmount: 30012 }],
        }),
        currencyStats('JPY', {
          count: 1,
          activeCount: 1,
          recurringCount: 1,
          monthlyAmount: 1234,
          annualAmount: 14808,
          categories: [{ category: 'cloud', count: 1, annualAmount: 14808 }],
        }),
      ]),
    )
    expect(wrapper.get('.subscription-budget__amount strong').text()).toBe('25.01')
    await wrapper.setProps({ currency: 'JPY' })
    expect(wrapper.get('.subscription-budget__amount').attributes('aria-label')).toBe('JPY 1,234 每月预算')
    expect(wrapper.getComponent(ChartStub).props()).toMatchObject({
      currency: 'JPY',
      labels: ['云服务'],
      values: [14808],
      formattedValues: ['14,808'],
    })
    expect(wrapper.get('.subscription-breakdown__list').text()).not.toContain('开发工具')

    await wrapper.setProps({ stats: stats([currencyStats('JPY', { monthlyAmount: 0 })]) })
    expect(wrapper.get('.subscription-budget__amount').attributes('aria-label')).toBe('JPY 0 每月预算')
    expect(wrapper.findComponent(ChartStub).exists()).toBe(false)
    expect(wrapper.find('.subscription-breakdown__list').exists()).toBe(false)
  })

  it('缺少当前币种时显示零预算和筛选空态，不混入其他币种', async () => {
    const wrapper = await setup(
      stats([
        currencyStats('CNY', {
          count: 2,
          activeCount: 2,
          recurringCount: 2,
          monthlyAmount: 10000,
          annualAmount: 120000,
          categories: [{ category: 'cloud', count: 2, annualAmount: 120000 }],
        }),
      ]),
    )
    expect(wrapper.get('.subscription-budget__amount').attributes('aria-label')).toBe('USD 0.00 每月预算')
    expect(wrapper.get('.subscription-budget__annual').text()).toContain('年化 USD 0.00')
    expect(wrapper.get('.subscription-budget__annual').text()).toContain('0 项持续订阅')
    expect(wrapper.get('.subscription-breakdown__empty').text()).toBe('当前筛选下没有 USD 订阅。')
    expect(wrapper.get('details').text()).toContain('当前筛选下没有分类记录。')
    expect(wrapper.findComponent(ChartStub).exists()).toBe(false)
  })

  it('已有记录但没有持续费用时保留零额分类明细并说明无非零费用', async () => {
    const wrapper = await setup(
      stats([
        currencyStats('USD', {
          count: 1,
          activeCount: 1,
          oneTimeAmount: 2000,
          categories: [{ category: 'design', count: 1, annualAmount: 0 }],
        }),
      ]),
    )
    expect(wrapper.get('.subscription-breakdown__empty').text()).toBe('当前币种没有非零持续费用。')
    expect(wrapper.get('.subscription-breakdown__list').text()).toContain('设计1 条记录USD 0.00 / 年')
    expect(wrapper.findComponent(ChartStub).exists()).toBe(false)
  })
})
