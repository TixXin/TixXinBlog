/** @file subscriptionCard.test.ts @description 订阅行的扣费提醒、原币金额、可读状态、详情焦点与图标恢复回归 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises } from '@vue/test-utils'
import { mockComponent, mountSuspended } from '@nuxt/test-utils/runtime'
import Card from '../../app/components/subscription/Card.vue'
import type { SubscriptionItem } from '../../app/features/subscription/types'

// 图标渲染器不属于订阅行职责；保留 Lucide 名称断言，避免挂载依赖图标包的异步加载。
mockComponent('Icon', async () => {
  const { defineComponent, h } = await import('vue')
  return defineComponent({
    props: { name: String },
    setup: (props) => () => h('span', { 'data-icon': props.name }),
  })
})

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
const hosts: HTMLElement[] = []
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
  hosts.splice(0).forEach((host) => host.remove())
  vi.restoreAllMocks()
})
async function setup(overrides: Partial<SubscriptionItem> = {}, today = '2026-10-15', attachTo?: HTMLElement) {
  const wrapper = await mountSuspended(Card, {
    props: { item: { ...item, ...overrides }, today },
    attachTo,
    global: { stubs: { SubscriptionHistory: true } },
  })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}
const imageSelector = '.subscription-list-row img',
  fallbackSelector = '.subscription-list-icon [data-icon="lucide:credit-card"]'

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

describe('订阅行扣费提醒', () => {
  it.each([
    { today: '2026-10-15', date: '2026-10-15', hint: '今天扣费' },
    { today: '2026-10-15', date: '2026-10-16', hint: '明天扣费' },
    { today: '2026-10-15', date: '2026-10-17', hint: '2 天后扣费' },
    { today: '2026-10-15', date: '2026-10-22', hint: '7 天后扣费' },
    { today: '2026-12-31', date: '2027-01-01', hint: '明天扣费' },
    { today: '2028-02-28', date: '2028-03-01', hint: '2 天后扣费' },
  ])('$today 至 $date 显示「$hint」且不标记逾期', async ({ today, date, hint }) => {
    const wrapper = await setup({ nextBillingDate: date }, today)
    const billing = wrapper.get('.subscription-list-date')

    expect(billing.get('span').text()).toBe(date)
    expect(billing.get('.subscription-list-date-note--soon').text()).toBe(hint)
    expect(billing.classes()).not.toContain('subscription-list-date--overdue')
    expect(billing.text()).not.toContain('已逾期')
  })

  it.each([
    { date: '2026-10-23', label: '2026-10-23' },
    { date: null, label: '扣费日期未设置' },
  ])('超过七天或日期未知时不显示临近扣费提示：$label', async ({ date, label }) => {
    const wrapper = await setup({ nextBillingDate: date })
    const billing = wrapper.get('.subscription-list-date')

    expect(billing.text()).toBe(label)
    expect(billing.find('.subscription-list-date-note').exists()).toBe(false)
    expect(billing.classes()).not.toContain('subscription-list-date--overdue')
  })

  it('逾期保留原扣费日期，列表与详情均提示核对而不推进日期', async () => {
    const wrapper = await setup({ nextBillingDate: '2026-09-28' })
    const billing = wrapper.get('.subscription-list-date')

    expect(billing.get('span').text()).toBe('2026-09-28')
    expect(billing.classes()).toContain('subscription-list-date--overdue')
    expect(billing.get('.subscription-list-date-note').text()).toBe('已逾期，请核对')
    expect(billing.find('.subscription-list-date-note--soon').exists()).toBe(false)
    await wrapper.get('.subscription-list-row').trigger('click')
    await flushPromises()

    const dialog = new DOMWrapper(document.querySelector<HTMLElement>('[role="dialog"]')!)
    const nextBilling = dialog.findAll('dl > div').find((fact) => fact.get('dt').text() === '下次扣费')!
    expect(nextBilling.get('dd').text()).toBe('2026-09-28 · 已逾期，请核对')
    expect(nextBilling.get('dd').classes()).toContain('subscription-list-date--overdue')
  })

  it('业务日变化时从明天切到今天再到逾期，更新扣费日期后移除旧提醒', async () => {
    const wrapper = await setup({ nextBillingDate: '2026-10-16' })
    const billing = () => wrapper.get('.subscription-list-date')

    expect(billing().get('.subscription-list-date-note').text()).toBe('明天扣费')
    await wrapper.setProps({ today: '2026-10-16' })
    expect(billing().get('.subscription-list-date-note').text()).toBe('今天扣费')
    await wrapper.setProps({ today: '2026-10-17' })
    expect(billing().get('.subscription-list-date-note').text()).toBe('已逾期，请核对')
    expect(billing().classes()).toContain('subscription-list-date--overdue')

    await wrapper.setProps({ item: { ...item, nextBillingDate: '2026-10-18' } })
    expect(billing().get('.subscription-list-date-note--soon').text()).toBe('明天扣费')
    expect(billing().classes()).not.toContain('subscription-list-date--overdue')
    await wrapper.setProps({ item: { ...item, nextBillingDate: null } })
    expect(billing().text()).toBe('扣费日期未设置')
    expect(billing().find('.subscription-list-date-note').exists()).toBe(false)
  })
})

describe('订阅行原币金额与周期', () => {
  it.each([
    { currency: 'CNY', expected: 'CNY 1,234.56' },
    { currency: 'USD', expected: 'USD 1,234.56' },
    { currency: 'EUR', expected: 'EUR 1,234.56' },
    { currency: 'GBP', expected: 'GBP 1,234.56' },
    { currency: 'JPY', expected: 'JPY 123,456' },
    { currency: 'HKD', expected: 'HKD 1,234.56' },
    { currency: 'TWD', expected: 'TWD 1,234.56' },
  ] as const)('$currency 最小单位按原币精度与千位分隔显示', async ({ currency, expected }) => {
    const wrapper = await setup({ amount: 123456, currency })

    expect(wrapper.get('.subscription-list-price strong').text()).toBe(expected)
    await wrapper.get('.subscription-list-row').trigger('click')
    await flushPromises()
    const dialog = new DOMWrapper(document.querySelector<HTMLElement>('[role="dialog"]')!)
    expect(dialog.get('.subscription-detail-price strong').text()).toBe(expected)
  })

  it.each([
    { amount: 0, currency: 'USD', expected: 'USD 0.00' },
    { amount: 1, currency: 'USD', expected: 'USD 0.01' },
    { amount: 0, currency: 'JPY', expected: 'JPY 0' },
    { amount: 1, currency: 'JPY', expected: 'JPY 1' },
  ] as const)('零金额和最小单位不会被隐藏或舍弃：$expected', async ({ amount, currency, expected }) => {
    const wrapper = await setup({ amount, currency })
    expect(wrapper.get('.subscription-list-price strong').text()).toBe(expected)
  })

  it.each([
    { billingCycle: 'monthly', suffix: '/ 月' },
    { billingCycle: 'quarterly', suffix: '/ 季' },
    { billingCycle: 'yearly', suffix: '/ 年' },
    { billingCycle: 'lifetime', suffix: '买断' },
    { billingCycle: 'one-time', suffix: '一次性' },
  ] as const)('$billingCycle 使用正确的金额周期说明', async ({ billingCycle, suffix }) => {
    const wrapper = await setup({ billingCycle })
    expect(wrapper.get('.subscription-list-price > span').text()).toBe(suffix)
  })
})

describe('订阅行状态与可访问详情', () => {
  it.each([
    { subscriptionStatus: 'active', label: '活跃' },
    { subscriptionStatus: 'paused', label: '暂停' },
    { subscriptionStatus: 'cancelled', label: '已取消' },
    { subscriptionStatus: 'trial', label: '试用' },
    { subscriptionStatus: 'expired', label: '已过期' },
  ] as const)('$subscriptionStatus 同时提供装饰圆点与可读的「$label」', async ({ subscriptionStatus, label }) => {
    const wrapper = await setup({ subscriptionStatus })
    const status = wrapper.get('.subscription-list-status')

    expect(status.text()).toBe(label)
    expect(status.classes()).toContain(`subscription-list-status--${subscriptionStatus}`)
    const dot = status.get('.subscription-list-status__dot')
    expect(dot.element.tagName).toBe('SPAN')
    expect(dot.attributes('aria-hidden')).toBe('true')
    expect(dot.text()).toBe('')
    expect(status.findAll('.subscription-list-status__dot')).toHaveLength(1)
  })

  it('未来开始标记随业务日更新移除，并保留原订阅状态', async () => {
    const wrapper = await setup({ startDate: '2026-10-16' })

    expect(wrapper.get('.subscription-list-status').text()).toBe('活跃 · 未来开始')
    await wrapper.setProps({ today: '2026-10-16' })
    expect(wrapper.get('.subscription-list-status').text()).toBe('活跃')
    expect(wrapper.get('.subscription-list-status').classes()).toContain('subscription-list-status--active')
  })

  it('原生按钮以金额、状态和日期描述详情入口，Escape 关闭后归还焦点', async () => {
    // happy-dom 不执行布局；只补充可见矩形，让真实焦点管理按可见按钮工作。
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([
      new DOMRect(0, 0, 200, 44),
    ] as unknown as DOMRectList)
    const host = document.createElement('div')
    document.body.append(host)
    hosts.push(host)
    const wrapper = await setup({ nextBillingDate: '2026-10-16' }, '2026-10-15', host)
    const row = wrapper.get('.subscription-list-row')

    expect(row.element.tagName).toBe('BUTTON')
    expect(row.attributes('type')).toBe('button')
    expect(row.attributes('aria-label')).toBe('查看云端工作台的订阅详情')
    expect(row.attributes('aria-haspopup')).toBe('dialog')
    expect(row.attributes('aria-expanded')).toBe('false')
    const description = row.attributes('aria-describedby')!.split(' ')
    expect(description).toHaveLength(3)
    expect(description.map((id) => document.getElementById(id)?.textContent?.trim())).toEqual([
      'USD 20.00/ 月',
      '活跃',
      '2026-10-16明天扣费',
    ])

    await row.trigger('click')
    await flushPromises()
    const dialog = new DOMWrapper(document.querySelector<HTMLElement>('[role="dialog"]')!)
    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(dialog.attributes('aria-label')).toBe('云端工作台订阅详情')
    expect(row.attributes('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(dialog.get('button[aria-label="关闭订阅详情"]').element)

    await dialog.trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(row.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(row.element)
  })
})
