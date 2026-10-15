/** @file subscriptionCard.test.ts @description 订阅行图标覆盖水合前失败、运行时失败及相同地址恢复，避免破图或无限重试 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import Card from '../../app/components/subscription/Card.vue'
import type { SubscriptionItem } from '../../app/features/subscription/types'

const item: SubscriptionItem = {
  id: 1,
  name: '云端工作台',
  description: '',
  platform: null,
  url: 'https://vuejs.org/',
  category: 'development',
  currency: 'USD',
  amount: 2000,
  billingCycle: 'monthly',
  startDate: null,
  nextBillingDate: null,
  subscriptionStatus: 'active',
  iconUrl: '/api/v1/subscriptions/favicons/existing-icon.webp',
  faviconUrl: '/api/v1/subscriptions/favicons/existing-icon.webp',
  priceHistory: [],
  publishedAt: null,
}
const wrappers: { unmount(): void }[] = []
let imageComplete = false,
  imageWidth = 0
beforeEach(() => {
  imageComplete = false
  imageWidth = 0
  // 模拟浏览器已经缓存的加载结果，不依赖 happy-dom 是否实际请求图片。
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockImplementation(() => imageComplete)
  vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockImplementation(() => imageWidth)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})
async function setup() {
  const wrapper = await mountSuspended(Card, {
    props: { item: { ...item }, today: '2026-10-15' },
    global: { stubs: { SubscriptionHistory: true } },
  })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}
const imageSelector = '.subscription-list-row img',
  fallbackSelector = '.subscription-list-icon [class~="i-lucide:credit-card"]'

describe('订阅行图标加载状态', () => {
  it('水合绑定事件前已失败的缓存图片，在挂载时直接降级且不循环重建图片', async () => {
    imageComplete = true
    const wrapper = await setup()
    expect(wrapper.find(imageSelector).exists()).toBe(false)
    expect(wrapper.find(fallbackSelector).exists()).toBe(true)
    await flushPromises()
    expect(wrapper.find(imageSelector).exists()).toBe(false)
  })

  it('挂载时尚未完成的图片继续加载，随后error事件切换为Lucide图标', async () => {
    const wrapper = await setup()
    expect(wrapper.get(imageSelector).attributes('src')).toBe(item.iconUrl)
    expect(wrapper.find(fallbackSelector).exists()).toBe(false)
    await wrapper.get(imageSelector).trigger('error')
    expect(wrapper.find(imageSelector).exists()).toBe(false)
    expect(wrapper.find(fallbackSelector).exists()).toBe(true)
  })

  it('重新读取新item时，即使图标地址相同也重试并保留已经加载成功的图片', async () => {
    imageComplete = true
    const wrapper = await setup()
    expect(wrapper.find(fallbackSelector).exists()).toBe(true)
    imageWidth = 44
    await wrapper.setProps({ item: { ...item, description: '已重新读取的记录' } })
    await flushPromises()
    expect(wrapper.get(imageSelector).attributes('src')).toBe(item.iconUrl)
    expect(wrapper.get(imageSelector).element).toHaveProperty('naturalWidth', 44)
    expect(wrapper.find(fallbackSelector).exists()).toBe(false)
  })
})
