/** @file postTaxonomyLinks.test.ts @description 首页标签与专栏入口保留可抓取链接、独立筛选和读屏状态 */
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PostFilters from '../../app/components/sidebar/PostFilters.vue'

const tags = [{ name: 'Vue 3 / 中文#入门', count: 4, color: '#3b82f6' }]
const categories = [
  {
    name: '前端 / 工程实践',
    count: 7,
    icon: 'lucide:code-xml',
    iconColor: '#3b82f6',
    iconBg: 'rgba(59, 130, 246, 0.12)',
  },
]
const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

async function setup() {
  const wrapper = await mountSuspended(PostFilters, {
    props: { tags, categories, available: true, pending: false, error: false },
  })
  wrappers.push(wrapper)
  return wrapper
}

describe('首页标签与专栏入口', () => {
  it('使用原名称生成编码链接，中文、空格和路径分隔符不改变标签或专栏标识', async () => {
    const wrapper = await setup()
    const tagLink = wrapper.get('.tag-cloud-card a')
    const categoryLink = wrapper.get('.category-card a')
    expect(tagLink.attributes('href')).toBe(`/tags/${encodeURIComponent(tags[0]!.name)}`)
    expect(categoryLink.attributes('href')).toBe(`/categories/${encodeURIComponent(categories[0]!.name)}`)
    expect(tagLink.text()).toContain(tags[0]!.name)
    expect(categoryLink.text()).toContain(categories[0]!.name)
    expect(tagLink.attributes('aria-pressed')).toBeUndefined()
    expect(categoryLink.attributes('aria-pressed')).toBeUndefined()
  })

  it('标签和专栏各保留独立筛选按钮，并沿原事件链传递完整名称', async () => {
    const wrapper = await setup()
    const tagFilter = wrapper.get('.tag-cloud-card button')
    const categoryFilter = wrapper.get('.category-card button')
    expect(tagFilter.attributes('type')).toBe('button')
    expect(categoryFilter.attributes('type')).toBe('button')
    expect(tagFilter.attributes('aria-label')).toBe(`在首页筛选标签：${tags[0]!.name}`)
    expect(categoryFilter.attributes('aria-label')).toBe(`在首页筛选专栏：${categories[0]!.name}`)
    expect(tagFilter.element.closest('a')).toBeNull()
    expect(categoryFilter.element.closest('a')).toBeNull()
    await tagFilter.trigger('click')
    expect(wrapper.emitted('select-tag')).toEqual([[tags[0]!.name]])
    expect(wrapper.emitted('select-category')).toBeUndefined()
    await categoryFilter.trigger('click')
    expect(wrapper.emitted('select-category')).toEqual([[categories[0]!.name]])
  })

  it('筛选按钮随首页选中与清除更新读屏状态，标签页链接保持可用', async () => {
    const wrapper = await setup()
    const filters = wrapper.findAll('button[aria-pressed]')
    expect(filters.map((button) => button.attributes('aria-pressed'))).toEqual(['false', 'false'])
    await wrapper.setProps({ activeTag: tags[0]!.name, activeCategory: categories[0]!.name })
    expect(filters.map((button) => button.attributes('aria-pressed'))).toEqual(['true', 'true'])
    expect(wrapper.findAll('a')).toHaveLength(2)
    await wrapper.setProps({ activeTag: null, activeCategory: null })
    expect(filters.map((button) => button.attributes('aria-pressed'))).toEqual(['false', 'false'])
  })

  it('真实空目录不生成占位标签或专栏链接', async () => {
    const wrapper = await setup()
    await wrapper.setProps({ tags: [], categories: [] })
    expect(wrapper.findAll('a')).toHaveLength(0)
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.text()).toContain('暂无标签')
    expect(wrapper.text()).toContain('暂无分类')
  })
})
