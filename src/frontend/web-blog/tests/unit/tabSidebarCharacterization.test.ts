/** @file tabSidebarCharacterization.test.ts @description 标签页悬浮侧栏的渲染表征：展开、折叠、只读与外观设置的结构快照，书签拖放、右键菜单、底部按钮与指针排序的事件载荷，拆分前后必须一致 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useState } from '#app'
import TabSidebarFloating from '../../app/components/tab/TabSidebarFloating.vue'
import { TAB_SETTINGS_DEFAULTS } from '../../app/composables/useTabSettings'
import type { TabSettings } from '../../app/composables/useTabSettings'
import type { BookmarkCategory } from '../../app/features/tab/types'

const mocks = vi.hoisted(() => ({
  settings: { value: {} } as Ref<TabSettings>,
  start: vi.fn(),
  stop: vi.fn(),
  option: vi.fn(),
  sortable: [] as unknown[][],
}))
mockNuxtImport('useTabSettings', () => () => ({ settings: mocks.settings }))
vi.mock('@vueuse/integrations/useSortable', () => ({
  useSortable: (...args: unknown[]) => {
    mocks.sortable.push(args)
    return { start: mocks.start, stop: mocks.stop, option: mocks.option }
  },
}))

const categories = (): BookmarkCategory[] =>
  ['开发文档', '阅读清单', '设计参考'].map((name, index) => ({
    id: `category-${index + 1}`,
    userId: 'owner',
    name,
    icon: index === 2 ? '' : 'lucide:folder',
    color: '#64748b',
    sortOrder: (index + 1) * 100,
  }))

const wrappers: { unmount(): void }[] = []
async function mountSidebar(props: Record<string, unknown> = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  const wrapper = await mountSuspended(TabSidebarFloating, {
    attachTo: host,
    props: {
      user: null,
      categories: categories(),
      activeId: 'category-1',
      counts: { 'category-1': 3, 'category-2': 1 },
      totalCount: 4,
      ...props,
    },
    global: { stubs: { Icon: true, CommonTooltip: { template: '<div class="tooltip"><slot /></div>' } } },
  })
  wrappers.push({
    unmount: () => {
      wrapper.unmount()
      host.remove()
    },
  })
  return wrapper
}
/** 去掉 scoped 样式标记，只比较结构、属性与文字 */
const markup = (html: string) => html.replace(/ data-v-[a-f0-9]+(="")?/g, '')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.sortable.length = 0
  mocks.settings = ref({ ...TAB_SETTINGS_DEFAULTS })
  useState('motion-reduced').value = false
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

it('展开、折叠、只读与外观设置', async () => {
  const expanded = await mountSidebar({ user: { id: 'u', nickname: '林间', avatar: '/avatar.webp' } })
  const trace: string[] = [markup(expanded.html())]
  await expanded.setProps({ collapsed: true })
  trace.push(markup(expanded.html()))
  mocks.settings.value = {
    ...mocks.settings.value,
    showCounts: false,
    sidebarBlur: false,
    sidebarOpacity: 0.55,
    sidebarRadius: 4,
  }
  const readOnly = await mountSidebar({ readOnly: true })
  trace.push(markup(readOnly.html()))
  expect(trace).toMatchSnapshot()
})

it('选择、折叠切换、右键、新建分类、设置与赞助的事件', async () => {
  const wrapper = await mountSidebar()
  await wrapper.get('[data-category-id="category-2"]').trigger('click')
  await wrapper.get('[data-category-id="category-3"]').trigger('contextmenu', { clientX: 12, clientY: 34 })
  await wrapper.get('.tab-side__toggle').trigger('click')
  const expandedButtons = wrapper.findAll('.tab-side__action, .tab-side__bottom-btn')
  await wrapper.setProps({ collapsed: false })
  for (const button of wrapper.findAll('.tab-side__action, .tab-side__bottom-btn')) await button.trigger('click')
  await wrapper.setProps({ collapsed: true })
  for (const button of wrapper.findAll('.tab-side__action, .tab-side__bottom-btn')) await button.trigger('click')
  expect({
    expandedButtons: expandedButtons.length,
    select: wrapper.emitted('select'),
    contextmenu: wrapper.emitted('categoryContextMenu'),
    collapsed: wrapper.emitted('update:collapsed'),
    addCategory: wrapper.emitted('addCategory')?.length,
    openSettings: wrapper.emitted('openSettings')?.length,
    openDonate: wrapper.emitted('openDonate')?.length,
  }).toMatchSnapshot()
})

it('书签拖放到分类：悬浮高亮、离开撤销、放下发出书签与目标分类', async () => {
  const wrapper = await mountSidebar()
  const target = wrapper.get('[data-category-id="category-2"]')
  await target.trigger('dragenter')
  expect(target.classes()).toContain('tab-side__cat--drop')
  await wrapper.get('[data-category-id="category-3"]').trigger('dragleave')
  expect(target.classes()).toContain('tab-side__cat--drop')
  await target.trigger('dragleave')
  expect(target.classes()).not.toContain('tab-side__cat--drop')
  const dataTransfer = {
    dropEffect: 'none',
    getData: (type: string) => (type === 'application/x-bookmark-id' ? 'bm-1' : ''),
  }
  await target.trigger('dragenter')
  await target.trigger('dragover', { dataTransfer })
  expect(dataTransfer.dropEffect).toBe('move')
  await target.trigger('drop', { dataTransfer })
  expect(target.classes()).not.toContain('tab-side__cat--drop')
  await target.trigger('drop', { dataTransfer: { getData: () => '' } })
  expect(wrapper.emitted('bookmarkDropped')).toEqual([[{ bookmarkId: 'bm-1', targetCategoryId: 'category-2' }]])
})

it('指针排序：参数、开关随只读与拖拽设置、减少动效，结束后按新顺序发出排序', async () => {
  const wrapper = await mountSidebar()
  const [, list, options] = mocks.sortable[0] as [unknown, Ref<BookmarkCategory[]>, Record<string, unknown>]
  const trace: unknown[] = [
    Object.fromEntries(Object.entries(options).filter(([, value]) => typeof value !== 'function')),
    mocks.start.mock.calls.length,
    mocks.stop.mock.calls.length,
  ]
  useState('motion-reduced').value = true
  mocks.settings.value = { ...mocks.settings.value, dragEnabled: false }
  await nextTick()
  trace.push(mocks.stop.mock.calls.length, mocks.option.mock.calls)
  list.value = [list.value[2]!, list.value[0]!, list.value[1]!]
  const onEnd = options.onEnd as (evt: { to: unknown; from: unknown }) => Promise<void>
  await onEnd({ to: 'a', from: 'b' })
  await onEnd({ to: 'a', from: 'a' })
  await flushPromises()
  trace.push(
    wrapper.emitted('reorderCategories'),
    list.value.map((category) => category.id),
  )
  await wrapper.setProps({ readOnly: true })
  trace.push(mocks.stop.mock.calls.length)
  expect(trace).toMatchSnapshot()
})
