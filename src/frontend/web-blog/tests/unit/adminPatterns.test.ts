/**
 * @file adminPatterns.test.ts
 * @description 后台通用列表模式：页头插槽、状态色调、空状态、加载占位的读屏状态与筛选栏的提交与清除
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { h } from 'vue'
import PageHeader from '../../app/components/admin/PageHeader.vue'
import StatusBadge from '../../app/components/admin/StatusBadge.vue'
import EmptyState from '../../app/components/admin/EmptyState.vue'
import ListSkeleton from '../../app/components/admin/ListSkeleton.vue'
import FilterBar from '../../app/components/admin/FilterBar.vue'
import { adminStatusTone } from '../../app/features/admin/status'

const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
const global = { stubs: { Icon: true } }
async function mount<T>(component: T, options: Record<string, unknown>) {
  const wrapper = await mountSuspended(component as never, { global, ...options })
  wrappers.push(wrapper)
  return wrapper
}

describe('后台通用列表模式', () => {
  it('页头只在有说明与操作时渲染对应区域', async () => {
    const bare = await mount(PageHeader, { props: { title: '文章' } })
    expect(bare.get('h1').text()).toBe('文章')
    expect(bare.find('p').exists()).toBe(false)
    expect(bare.find('.admin-toolbar').exists()).toBe(false)
    const full = await mount(PageHeader, {
      props: { title: '文章', intro: '管理全部文章' },
      slots: { actions: () => h('a', { href: '/admin/posts/new' }, '新建文章') },
    })
    expect(full.get('p').text()).toBe('管理全部文章')
    expect(full.get('.admin-toolbar a').text()).toBe('新建文章')
  })

  it.each([
    ['published', 'is-success'],
    ['pending', 'is-warning'],
    ['draft', 'is-warning'],
    ['hidden', 'is-danger'],
    ['archived', ''],
    ['withdrawn', ''],
    [null, ''],
  ])('状态 %s 映射为色调 %j', async (status, tone) => {
    expect(adminStatusTone(status)).toBe(tone)
    const badge = await mount(StatusBadge, { props: { status, label: '状态' } })
    expect(badge.classes()).toEqual(tone ? ['admin-badge', tone] : ['admin-badge'])
    expect(badge.text()).toBe('状态')
  })

  it('空状态显示标题、说明与后续操作', async () => {
    const wrapper = await mount(EmptyState, {
      props: { title: '暂无评论', description: '调整筛选后再试' },
      slots: { actions: () => h('button', '清除筛选') },
    })
    expect(wrapper.get('.admin-empty__title').text()).toBe('暂无评论')
    expect(wrapper.get('.admin-empty__description').text()).toBe('调整筛选后再试')
    expect(wrapper.get('.admin-empty__actions button').text()).toBe('清除筛选')
  })

  it('加载占位保留读屏状态，rows=0 时只剩状态文字', async () => {
    const wrapper = await mount(ListSkeleton, { props: { label: '正在加载文章…' } })
    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.get('.sr-only').text()).toBe('正在加载文章…')
    expect(wrapper.findAll('.admin-skeleton__item')).toHaveLength(4)
    expect(wrapper.get('.admin-skeleton__item').attributes('aria-hidden')).toBe('true')
    await wrapper.setProps({ rows: 0, variant: 'cards' })
    expect(wrapper.findAll('.admin-skeleton__item')).toHaveLength(0)
    expect(wrapper.classes()).toContain('admin-skeleton--cards')
  })

  it('筛选栏提交不导航，有生效筛选时才显示清除', async () => {
    const wrapper = await mount(FilterBar, {
      props: { label: '筛选文章' },
      slots: { default: () => h('input', { type: 'search' }), actions: () => h('button', { type: 'submit' }, '搜索') },
    })
    expect(wrapper.attributes('role')).toBe('search')
    expect(wrapper.attributes('aria-label')).toBe('筛选文章')
    expect(wrapper.text()).not.toContain('清除筛选')
    await wrapper.trigger('submit')
    expect(wrapper.emitted('submit')).toHaveLength(1)
    await wrapper.setProps({ active: true })
    await wrapper.findAll('button').at(-1)!.trigger('click')
    expect(wrapper.emitted('reset')).toHaveLength(1)
  })
})
