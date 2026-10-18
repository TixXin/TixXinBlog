/** @file subscriptionFilters.test.ts @description 订阅筛选的控件语义、完整选项、单字段事件与紧凑模式 */
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import Filters from '../../app/components/subscription/Filters.vue'
import type { SubscriptionQuery } from '../../app/features/subscription/types'

const wrappers: { unmount(): void }[] = []
const query: SubscriptionQuery = { page: 3, pageSize: 12 }
const fields = [
  { key: 'q', label: '搜索订阅', value: '云端工作台' },
  { key: 'category', label: '筛选订阅分类', value: 'cloud' },
  { key: 'currency', label: '筛选订阅币种', value: 'JPY' },
  { key: 'subscriptionStatus', label: '筛选订阅状态', value: 'paused' },
  { key: 'sort', label: '订阅排列方式', value: 'amount-desc' },
] as const

afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

async function setup(props: { query?: SubscriptionQuery; disabled?: boolean; compact?: boolean } = {}) {
  const wrapper = await mountSuspended(Filters, { props: { query: { ...query }, ...props } })
  wrappers.push(wrapper)
  return wrapper
}

describe('订阅筛选组件', () => {
  it('默认控件提供读屏名称、原生表单语义和完整筛选选项', async () => {
    const wrapper = await setup()
    const search = wrapper.get<HTMLInputElement>('[aria-label="搜索订阅"]')
    expect(search.element.type).toBe('search')
    expect(search.element.maxLength).toBe(200)
    expect(search.element.value).toBe('')
    expect(search.attributes('placeholder')).toBe('名称、平台或描述')
    expect(wrapper.findAll('label')).toHaveLength(5)
    for (const field of fields) {
      const control = wrapper.get<HTMLInputElement | HTMLSelectElement>(`[aria-label="${field.label}"]`)
      expect(control.element.disabled).toBe(false)
      expect(control.element.closest('label')).not.toBeNull()
      expect(control.attributes('tabindex')).not.toBe('-1')
    }
    const options = (label: string) =>
      wrapper
        .get(`[aria-label="${label}"]`)
        .findAll('option')
        .map((option) => [option.attributes('value'), option.text()])
    expect(options('筛选订阅分类')).toEqual([
      ['', '全部分类'],
      ['development', '开发工具'],
      ['cloud', '云服务'],
      ['entertainment', '影音娱乐'],
      ['productivity', '效率工具'],
      ['ai', '人工智能'],
      ['communication', '通信'],
      ['education', '学习教育'],
      ['design', '设计'],
      ['other', '其他'],
    ])
    expect(options('筛选订阅币种')).toEqual([
      ['', '全部币种（独立统计）'],
      ['CNY', 'CNY'],
      ['USD', 'USD'],
      ['EUR', 'EUR'],
      ['GBP', 'GBP'],
      ['JPY', 'JPY'],
      ['HKD', 'HKD'],
      ['TWD', 'TWD'],
    ])
    expect(options('筛选订阅状态')).toEqual([
      ['', '全部订阅状态'],
      ['active', '活跃'],
      ['paused', '暂停'],
      ['cancelled', '已取消'],
      ['trial', '试用'],
      ['expired', '已过期'],
    ])
    expect(options('订阅排列方式')).toEqual([
      ['manual', '默认排序'],
      ['amount-asc', '币种内原始金额升序'],
      ['amount-desc', '币种内原始金额降序'],
    ])
    expect(wrapper.get<HTMLSelectElement>('[aria-label="订阅排列方式"]').element.value).toBe('manual')
    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it.each(fields)('$label 仅提交当前字段，保留父级查询与页码', async ({ key, label, value }) => {
    const original: SubscriptionQuery = { ...query, currency: 'USD', category: 'development', sort: 'manual' }
    const wrapper = await setup({ query: original })
    await wrapper.get(`[aria-label="${label}"]`).setValue(value)
    expect(wrapper.emitted('change')).toEqual([[{ [key]: value }]])
    expect(original).toEqual({ ...query, currency: 'USD', category: 'development', sort: 'manual' })
  })

  it.each(fields.filter((field) => field.key !== 'sort'))(
    '$label 清空后发出 undefined，恢复不限条件',
    async ({ key, label, value }) => {
      const wrapper = await setup({ query: { ...query, [key]: value } })
      await wrapper.get(`[aria-label="${label}"]`).setValue('')
      expect(wrapper.emitted('change')).toEqual([[{ [key]: undefined }]])
    },
  )

  it('父级更新查询后同步显示各字段，组件不额外发出筛选事件', async () => {
    const wrapper = await setup()
    await wrapper.setProps({
      query: {
        ...query,
        q: '云端工作台',
        category: 'cloud',
        currency: 'JPY',
        subscriptionStatus: 'paused',
        sort: 'amount-desc',
      },
    })
    for (const field of fields) {
      expect(wrapper.get<HTMLInputElement | HTMLSelectElement>(`[aria-label="${field.label}"]`).element.value).toBe(
        field.value,
      )
    }
    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it('禁用状态传递至所有原生控件，解除后允许筛选', async () => {
    const wrapper = await setup({ disabled: true })
    expect(
      wrapper.findAll<HTMLInputElement | HTMLSelectElement>('input, select').every((field) => field.element.disabled),
    ).toBe(true)
    await wrapper.setProps({ disabled: false })
    expect(
      wrapper.findAll<HTMLInputElement | HTMLSelectElement>('input, select').every((field) => !field.element.disabled),
    ).toBe(true)
    await wrapper.get('[aria-label="筛选订阅状态"]').setValue('expired')
    expect(wrapper.emitted('change')).toEqual([[{ subscriptionStatus: 'expired' }]])
  })

  it('紧凑模式保留分类、状态和排序，恢复完整模式时保留搜索与币种', async () => {
    const wrapper = await setup({ compact: true, query: { ...query, q: '工作台', currency: 'JPY' } })
    expect(wrapper.findAll('input, select').map((field) => field.attributes('aria-label'))).toEqual([
      '筛选订阅分类',
      '筛选订阅状态',
      '订阅排列方式',
    ])
    await wrapper.get('[aria-label="筛选订阅分类"]').setValue('design')
    expect(wrapper.emitted('change')).toEqual([[{ category: 'design' }]])
    await wrapper.setProps({ compact: false })
    expect(wrapper.get<HTMLInputElement>('[aria-label="搜索订阅"]').element.value).toBe('工作台')
    expect(wrapper.get<HTMLSelectElement>('[aria-label="筛选订阅币种"]').element.value).toBe('JPY')
    expect(wrapper.emitted('change')).toHaveLength(1)
  })
})
