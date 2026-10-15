/** @file subscriptionForecast.test.ts @description 续费预测抽屉按币种取数，扣费清单升序且逾期标注，缺数据与全零预测给出说明 */
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import Forecast from '../../app/components/subscription/Forecast.vue'
import type { CurrencyStats, SubscriptionCurrency, SubscriptionStats } from '../../app/features/subscription/types'

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
  return { asOf: '2026-10-16', total: 0, activeCount: 0, recurringCount: 0, categoryCount: 0, currencies }
}
async function setup(value: SubscriptionStats, currency: SubscriptionCurrency = 'USD') {
  return await mountSuspended(Forecast, {
    props: { stats: value, currency },
    global: { stubs: { LazySubscriptionChart: true } },
  })
}

describe('订阅续费预测抽屉', () => {
  it('扣费清单按日期升序排列，逾期记录保留原日期并给出核对提示', async () => {
    const wrapper = await setup(
      stats([
        currencyStats('USD', {
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
    expect(rows[0]!.text()).toContain('已逾期，请核对')
    expect(rows[1]!.text()).not.toContain('已逾期')
    expect(rows[0]!.text()).toContain('USD 20.00')
    expect(wrapper.text()).not.toContain('当前条件下没有非零续费预测')
  })

  it('当前币种没有统计时，预测与扣费清单分别说明为空且不渲染图表', async () => {
    const wrapper = await setup(stats([currencyStats('CNY', { forecast: [{ month: '2026-10', amount: 1000 }] })]))
    expect(wrapper.text()).toContain('当前筛选下没有 USD 订阅，暂无续费预测。')
    expect(wrapper.text()).toContain('当前筛选没有可用的扣费日期。')
    expect(wrapper.find('.subscription-forecast__amounts').exists()).toBe(false)
  })

  it('有月份记录但预测金额全为零时保留图表并说明没有非零预测', async () => {
    const wrapper = await setup(
      stats([
        currencyStats('USD', {
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
    expect(wrapper.text()).toContain('截至 2026-10-16')
  })
})
