/** @file subscriptionFeed.test.ts @description 订阅分页与全量筛选统计同步接纳，迟到响应和部分失败不能混用口径 */
import { publicReadCache } from '../../app/utils/publicReadCache'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { statistics } from '@tixxin/subscription-domain'
import { useSubscriptions } from '../../app/composables/useSubscriptions'
const mocks = vi.hoisted(() => ({ list: vi.fn(), stats: vi.fn() }))
mockNuxtImport('useSubscriptionRepository', () => () => mocks)
const item = {
  id: 1,
  name: '创作服务',
  description: '',
  url: null,
  platform: null,
  category: 'development' as const,
  currency: 'USD' as const,
  amount: 2000,
  billingCycle: 'monthly' as const,
  startDate: null,
  nextBillingDate: null,
  subscriptionStatus: 'active' as const,
  iconUrl: null,
  faviconUrl: null,
  priceHistory: [],
  publishedAt: '2026-10-13T00:00:00.000Z',
}
const stat = statistics([item], '2026-10-13')
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  publicReadCache(useNuxtApp()).invalidate(['subscriptions'])
  mocks.list.mockReset().mockResolvedValue({ items: [item], total: 1, page: 1, pageSize: 12 })
  mocks.stats.mockReset().mockResolvedValue(stat)
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
async function setup(route = '/subscriptions') {
  let state!: Awaited<ReturnType<typeof useSubscriptions>>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        async setup() {
          clearNuxtData('subscriptions-feed')
          state = await useSubscriptions()
          return () => h('div')
        },
      }),
      { route },
    ),
  )
  return state
}
it.each(['/subscriptions', '/subscriptions?currency=BTC', '/subscriptions?currency='])(
  '%s 默认向列表和全量统计传递 USD',
  async (route) => {
    const state = await setup(route)
    expect(state.query.value.currency).toBe('USD')
    expect(mocks.list.mock.calls.at(-1)![0]).toMatchObject({ currency: 'USD', page: 1, pageSize: 12 })
    expect(mocks.stats.mock.calls.at(-1)![0]).toEqual(mocks.list.mock.calls.at(-1)![0])
    expect(state.stats.value?.currencies.map((entry) => entry.currency)).toEqual(['USD'])
  },
)
it('显式 JPY 分享 URL 同时恢复列表与预算币种，保留无小数单位金额', async () => {
  const yenItem = { ...item, currency: 'JPY' as const, amount: 1000 }
  mocks.list.mockResolvedValue({ items: [yenItem], total: 1, page: 1, pageSize: 12 })
  mocks.stats.mockResolvedValue(statistics([yenItem], '2026-10-13'))
  const state = await setup('/subscriptions?currency=JPY')
  expect(state.query.value.currency).toBe('JPY')
  expect(mocks.list.mock.calls.at(-1)![0]).toEqual(mocks.stats.mock.calls.at(-1)![0])
  expect(state.items.value[0]).toMatchObject({ currency: 'JPY', amount: 1000 })
  expect(state.stats.value?.currencies[0]).toMatchObject({ currency: 'JPY', annualAmount: 12000 })
})
it('换币种保留其它过滤条件并回到第一页，后续请求仍保持相同口径', async () => {
  const state = await setup('/subscriptions?currency=USD&page=3&category=ai&subscriptionStatus=active&q=creative')
  await state.changeQuery({ currency: 'JPY' })
  await vi.waitFor(() => expect(mocks.list.mock.calls.at(-1)![0].currency).toBe('JPY'))
  expect(state.query.value).toMatchObject({
    currency: 'JPY',
    page: 1,
    category: 'ai',
    subscriptionStatus: 'active',
    q: 'creative',
  })
  expect(mocks.stats.mock.calls.at(-1)![0]).toEqual(mocks.list.mock.calls.at(-1)![0])
})
it('统计失败不接纳只有列表的新结果，重试同时恢复全量统计', async () => {
  const state = await setup()
  mocks.list.mockResolvedValueOnce({ items: [{ ...item, id: 2 }], total: 20, page: 1, pageSize: 12 })
  mocks.stats.mockRejectedValueOnce(new Error('统计暂不可用'))
  await state.refresh()
  expect(state.error.value?.message).toBe('统计暂不可用')
  expect(state.items.value[0]?.id).toBe(1)
  expect(state.stats.value?.total).toBe(1)
  mocks.list.mockResolvedValueOnce({ items: [{ ...item, id: 2 }], total: 20, page: 1, pageSize: 12 })
  mocks.stats.mockResolvedValueOnce({ ...stat, total: 20 })
  await state.refresh()
  expect(state.items.value[0]?.id).toBe(2)
  expect(state.stats.value?.total).toBe(20)
})
it('筛选切换保持查询口径，切回有效缓存立即复用且迟到响应不能回填', async () => {
  const state = await setup()
  let finish!: (value: unknown) => void
  mocks.list.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  await state.changeQuery({ currency: 'JPY' })
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  expect(state.items.value).toHaveLength(0)
  expect(state.stats.value).toBeNull()
  expect(mocks.stats.mock.calls.at(-1)![0]).toEqual(mocks.list.mock.calls.at(-1)![0])
  mocks.list.mockResolvedValueOnce({ items: [{ ...item, id: 3 }], total: 1, page: 1, pageSize: 12 })
  mocks.stats.mockResolvedValueOnce(stat)
  await state.changeQuery({ currency: 'USD' })
  await vi.waitFor(() => expect(state.items.value[0]?.id).toBe(1))
  expect(mocks.list).toHaveBeenCalledTimes(2)
  finish({ items: [{ ...item, id: 2, currency: 'JPY' }], total: 1, page: 1, pageSize: 12 })
  await flushPromises()
  expect(state.items.value[0]?.id).toBe(1)
  expect(state.stats.value?.currencies[0]?.currency).toBe('USD')
})
it('无成功响应时显式错误，不生成零统计', async () => {
  mocks.list.mockRejectedValue(new Error('服务不可用'))
  const state = await setup()
  expect(state.error.value?.message).toBe('服务不可用')
  expect(state.total.value).toBeNull()
  expect(state.stats.value).toBeNull()
})
