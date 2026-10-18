/** @file sidebarPostCards.test.ts @description 文章侧栏卡片的空数据、请求反馈、筛选可达性与真实统计回归 */
import { afterEach, describe, expect, it } from 'vitest'
import { mount, type DOMWrapper } from '@vue/test-utils'
import TagCloudCard from '../../app/components/sidebar/TagCloudCard.vue'
import CategoryCard from '../../app/components/sidebar/CategoryCard.vue'
import PostFilters from '../../app/components/sidebar/PostFilters.vue'
import SiteStatsCard from '../../app/components/sidebar/SiteStatsCard.vue'
import RequestFeedback from '../../app/components/common/RequestFeedback.vue'
import type { CategoryItem, SiteStats, TagItem } from '../../app/features/stats/types'

const wrappers: { unmount(): void }[] = []
const targets: HTMLElement[] = []
const tags: TagItem[] = [
  { name: 'Vue 进阶', count: 12, color: '#42b883' },
  { name: '山间步道', count: 0, color: '#409eff' },
]
const categories: CategoryItem[] = [
  { name: '前端札记', count: 8, icon: 'lucide:code', iconColor: '#42b883', iconBg: '#eefaf4' },
  { name: '生活碎片', count: 0, icon: 'lucide:coffee', iconColor: '#d97706', iconBg: '#fff7ed' },
]

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  targets.splice(0).forEach((target) => target.remove())
})

function mountOptions() {
  const target = document.createElement('div')
  document.body.append(target)
  targets.push(target)
  return { attachTo: target, global: { stubs: { Icon: true } } }
}

function keep<T extends { unmount(): void }>(wrapper: T): T {
  wrappers.push(wrapper)
  return wrapper
}

function expectFocusableButton(button: DOMWrapper<Element>) {
  expect(button.element).toBeInstanceOf(HTMLButtonElement)
  const element = button.element as HTMLButtonElement
  expect(element.type).toBe('button')
  expect(element.disabled).toBe(false)
  expect(element.tabIndex).toBe(0)
  element.focus()
  expect(document.activeElement).toBe(element)
}

function mountFilters(overrides: Partial<InstanceType<typeof PostFilters>['$props']> = {}) {
  return keep(
    mount(PostFilters, {
      ...mountOptions(),
      props: { tags: [], categories: [], available: false, pending: false, error: false, ...overrides },
    }),
  )
}

describe('标签云卡片', () => {
  it('真实空列表显示零个标签和空态，不创建筛选操作', () => {
    const wrapper = keep(mount(TagCloudCard, { ...mountOptions(), props: { tags: [] } }))
    expect(wrapper.text()).toContain('0 个标签')
    expect(wrapper.text()).toContain('暂无标签')
    expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe('按标签筛选')
    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('每个标签只显示一次，原生按钮可聚焦且选中状态随父级更新', async () => {
    const wrapper = keep(mount(TagCloudCard, { ...mountOptions(), props: { tags, activeTag: 'Vue 进阶' } }))
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(2)
    expect(wrapper.text()).toContain('2 个标签')
    expect(wrapper.findAll('.tag-cloud-card__tag-count').map((count) => count.text())).toEqual(['12', '0'])
    expect(buttons.map((button) => button.attributes('aria-pressed'))).toEqual(['true', 'false'])
    expect(wrapper.get('.tag-cloud-card__hash').attributes('aria-hidden')).toBe('true')
    for (const button of buttons) expectFocusableButton(button)

    // DOM 环境不模拟浏览器的 Enter/空格默认激活；验证原生按钮焦点与激活后的事件契约。
    await buttons[1]!.trigger('click')
    expect(wrapper.emitted('select')).toEqual([['山间步道']])
    expect(buttons[1]!.attributes('aria-pressed')).toBe('false')
    await wrapper.setProps({ activeTag: '山间步道' })
    expect(buttons.map((button) => button.attributes('aria-pressed'))).toEqual(['false', 'true'])
    expect(buttons[1]!.classes()).toContain('is-active')
    await wrapper.setProps({ activeTag: null })
    expect(buttons.every((button) => button.attributes('aria-pressed') === 'false')).toBe(true)
  })
})

describe('分类卡片', () => {
  it('真实空列表显示空态，不创建无效分类按钮', () => {
    const wrapper = keep(mount(CategoryCard, { ...mountOptions(), props: { categories: [] } }))
    expect(wrapper.text()).toContain('暂无分类')
    expect(wrapper.findAll('li')).toHaveLength(0)
    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('保留零篇分类，原生按钮可聚焦并把完整分类名交给父级', async () => {
    const wrapper = keep(
      mount(CategoryCard, {
        ...mountOptions(),
        props: { categories, activeCategory: '前端札记' },
      }),
    )
    const buttons = wrapper.findAll('li button')
    expect(buttons).toHaveLength(2)
    expect(wrapper.findAll('.category-card__badge').map((badge) => badge.text())).toEqual(['8', '0'])
    expect(buttons.map((button) => button.attributes('aria-pressed'))).toEqual(['true', 'false'])
    for (const button of buttons) expectFocusableButton(button)
    await buttons[1]!.trigger('click')
    expect(wrapper.emitted('select')).toEqual([['生活碎片']])
    await wrapper.setProps({ activeCategory: '生活碎片' })
    expect(buttons.map((button) => button.attributes('aria-pressed'))).toEqual(['false', 'true'])
    expect(buttons[1]!.classes()).toContain('is-active')
    await wrapper.setProps({ activeCategory: null })
    expect(buttons.every((button) => button.attributes('aria-pressed') === 'false')).toBe(true)
  })
})

describe('文章筛选组合卡片', () => {
  it('首次加载提供读屏状态并禁止重复重试，不把未读取的数据展示为空列表', async () => {
    const wrapper = mountFilters({ pending: true })
    expect(wrapper.get('[role="status"]').text()).toBe('正在加载…')
    expect(wrapper.get('.request-feedback').attributes('aria-busy')).toBe('true')
    expect(wrapper.findComponent(TagCloudCard).exists()).toBe(false)
    expect(wrapper.findComponent(CategoryCard).exists()).toBe(false)
    expect(wrapper.text()).not.toContain('暂无')
    const button = wrapper.get('button')
    expectFocusableButton(button)
    expect(button.attributes('aria-disabled')).toBe('true')
    await button.trigger('click')
    expect(wrapper.emitted('retry')).toBeUndefined()
  })

  it('首次失败显示真实错误和可聚焦重试入口，不回退空态或样本', async () => {
    const wrapper = mountFilters({ error: true })
    expect(wrapper.get('[role="alert"]').text()).toBe('标签和分类暂时不可用')
    expect(wrapper.findComponent(TagCloudCard).exists()).toBe(false)
    expect(wrapper.findComponent(CategoryCard).exists()).toBe(false)
    expect(wrapper.text()).not.toContain('暂无')
    const button = wrapper.get('button')
    expectFocusableButton(button)
    expect(button.attributes('aria-disabled')).toBe('false')
    await button.trigger('click')
    expect(wrapper.emitted('retry')).toEqual([[]])
  })

  it('成功读取的空列表同时呈现两个空态，不出现失败反馈', () => {
    const wrapper = mountFilters({ available: true })
    expect(wrapper.text()).toContain('暂无标签')
    expect(wrapper.text()).toContain('暂无分类')
    expect(wrapper.findComponent(RequestFeedback).exists()).toBe(false)
  })

  it('重新加载期间保留已成功读取的筛选与当前选择', () => {
    const wrapper = mountFilters({
      tags,
      categories,
      available: true,
      pending: true,
      activeTag: '山间步道',
      activeCategory: '生活碎片',
    })
    expect(wrapper.get('[role="status"]').text()).toBe('正在加载…')
    expect(wrapper.get('.tag-cloud-card__tag[aria-pressed="true"]').text()).toContain('山间步道')
    expect(wrapper.get('.category-card__item[aria-pressed="true"]').text()).toContain('生活碎片')
    expect(wrapper.text()).not.toContain('暂无')
  })

  it('刷新失败保留旧数据并透传选择与重试，成功恢复后撤下错误反馈', async () => {
    const wrapper = mountFilters({ tags, categories, available: true, error: true })
    expect(wrapper.get('[role="alert"]').text()).toContain('仍显示上次成功加载的数据。')
    await wrapper.get('.tag-cloud-card__tag').trigger('click')
    await wrapper.get('.category-card__item').trigger('click')
    await wrapper.get('.request-feedback button').trigger('click')
    expect(wrapper.emitted('select-tag')).toEqual([['Vue 进阶']])
    expect(wrapper.emitted('select-category')).toEqual([['前端札记']])
    expect(wrapper.emitted('retry')).toEqual([[]])
    await wrapper.setProps({ pending: true })
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
    await wrapper.get('.request-feedback button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
    await wrapper.setProps({ pending: false, error: false, tags: [], categories: [] })
    expect(wrapper.findComponent(RequestFeedback).exists()).toBe(false)
    expect(wrapper.text()).toContain('暂无标签')
    expect(wrapper.text()).toContain('暂无分类')
  })
})

describe('站点统计卡片', () => {
  const zeroStats: SiteStats = { articles: 0, views: '0', comments: 0, tags: 0, siteAgeDays: 0 }

  it.each([undefined, []])('保留真实零统计，活动为 %j 时不显示热力图', (activity) => {
    const wrapper = keep(
      mount(SiteStatsCard, {
        ...mountOptions(),
        props: { stats: { ...zeroStats, activity } },
        global: { stubs: { Icon: true, SidebarHeatmapGrid: true } },
      }),
    )
    expect(wrapper.get('.stats-card__uptime-days').text()).toBe('0 天')
    expect(wrapper.findAll('.stats-card__value').map((value) => value.text())).toEqual(['0', '0', '0', '0'])
    expect(wrapper.findAll('.stats-card__label').map((label) => label.text())).toEqual(['文章', '浏览', '评论', '标签'])
    expect(wrapper.findComponent({ name: 'SidebarHeatmapGrid' }).exists()).toBe(false)
  })

  it('接收新统计后更新数值，并把真实活动记录完整传入热力图', async () => {
    const wrapper = keep(
      mount(SiteStatsCard, {
        ...mountOptions(),
        props: { stats: zeroStats },
        global: { stubs: { Icon: true, SidebarHeatmapGrid: true } },
      }),
    )
    const activity = [{ date: '2026-10-18', articles: 1, comments: 2 }]
    await wrapper.setProps({ stats: { articles: 7, views: '1.2K', comments: 23, tags: 4, siteAgeDays: 365, activity } })
    expect(wrapper.get('.stats-card__uptime-days').text()).toBe('365 天')
    expect(wrapper.findAll('.stats-card__value').map((value) => value.text())).toEqual(['7', '1.2K', '23', '4'])
    expect(wrapper.getComponent({ name: 'SidebarHeatmapGrid' }).props('activity')).toEqual(activity)
    await wrapper.setProps({ stats: zeroStats })
    expect(wrapper.findComponent({ name: 'SidebarHeatmapGrid' }).exists()).toBe(false)
  })
})
