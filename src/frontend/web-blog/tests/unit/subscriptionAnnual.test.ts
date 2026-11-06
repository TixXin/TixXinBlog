/** @file subscriptionAnnual.test.ts @description 年度账单：按年估算扣费、逐项排行、当年调价与年份切换 */
import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockComponent, mountSuspended } from '@nuxt/test-utils/runtime'
import Annual from '../../app/components/subscription/Annual.vue'
import type { PriceChange, SubscriptionLike } from '@tixxin/subscription-domain'

mockComponent('Icon', async () => {
  const { defineComponent, h } = await import('vue')
  return defineComponent({ props: { name: String }, setup: (props) => () => h('span', { 'data-icon': props.name }) })
})

const entry = (date: string, amount: number) => ({
  id: crypto.randomUUID(),
  effectiveAt: `${date}T00:00:00.000Z`,
  recordedAt: `${date}T00:00:00.000Z`,
  amount,
  currency: 'USD' as const,
  billingCycle: 'monthly' as const,
})
const records: SubscriptionLike[] = [
  {
    id: 1,
    name: '云盘',
    category: 'cloud',
    currency: 'USD',
    amount: 2500,
    billingCycle: 'monthly',
    subscriptionStatus: 'active',
    startDate: '2025-11-10',
    nextBillingDate: null,
    priceHistory: [entry('2025-11-01', 2000), entry('2026-04-01', 2500)],
  },
  {
    id: 2,
    name: '域名',
    category: 'development',
    currency: 'USD',
    amount: 1200,
    billingCycle: 'yearly',
    subscriptionStatus: 'active',
    startDate: '2026-02-01',
    nextBillingDate: null,
  },
  {
    id: 3,
    name: '人民币服务',
    category: 'other',
    currency: 'CNY',
    amount: 900,
    billingCycle: 'monthly',
    subscriptionStatus: 'active',
    startDate: '2026-01-01',
    nextBillingDate: null,
  },
]
const changes: PriceChange[] = [
  {
    id: 1,
    name: '云盘',
    date: '2026-04-01',
    currency: 'USD',
    billingCycle: 'monthly',
    fromAmount: 2000,
    toAmount: 2500,
  },
]

describe('年度账单', () => {
  it('默认显示最近一年，只统计当前币种，并按金额排行', async () => {
    const wrapper = await mountSuspended(Annual, {
      props: { records, priceChanges: changes, currency: 'USD', today: '2026-06-15' },
    })
    await flushPromises()
    const years = wrapper.findAll('.subscription-annual__years button').map((button) => button.text())
    expect(years).toEqual(['2026', '2025'])
    // 2026：云盘 1–3 月 3×20.00 + 4–6 月 3×25.00 = 135.00；域名 12.00
    expect(wrapper.find('.subscription-annual__total strong').text()).toBe('USD 147.00')
    const rows = wrapper.findAll('.subscription-annual__ranking li').map((row) => row.find('span').text())
    expect(rows).toEqual(['云盘', '域名'])
    expect(wrapper.find('.subscription-annual__changes .is-up').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('人民币服务')
  })
  it('切换年份后合计与调价随之变化', async () => {
    const wrapper = await mountSuspended(Annual, {
      props: { records, priceChanges: changes, currency: 'USD', today: '2026-06-15' },
    })
    await wrapper.findAll('.subscription-annual__years button')[1]!.trigger('click')
    expect(wrapper.find('.subscription-annual__total strong').text()).toBe('USD 40.00')
    expect(wrapper.find('.subscription-annual__changes .is-up').exists()).toBe(false)
  })
})

describe('年度账单的跨币种折合', () => {
  it('有参考汇率时按年折合全部币种，缺汇率的币种单独列出', async () => {
    const wrapper = await mountSuspended(Annual, {
      props: {
        records: records.filter((record) => record.currency === 'USD'),
        priceChanges: changes,
        currency: 'USD',
        today: '2026-06-15',
        allRecords: [...records, { ...records[2]!, id: 4, name: '欧元服务', currency: 'EUR', amount: 100 }],
        rates: { base: 'CNY', rates: { USD: '7' } },
      },
    })
    await flushPromises()
    // 2026 年 USD 147.00 × 7 = 1029.00，CNY 6 × 9.00 = 54.00；EUR 无汇率
    const line = wrapper.find('.subscription-annual__converted').text()
    expect(line).toContain('CNY 1,083.00')
    expect(line).toContain('EUR')
  })
  it('未启用汇率或只有单一币种时不显示折合', async () => {
    const wrapper = await mountSuspended(Annual, {
      props: { records, priceChanges: changes, currency: 'USD', today: '2026-06-15', allRecords: records, rates: null },
    })
    expect(wrapper.find('.subscription-annual__converted').exists()).toBe(false)
  })
})
