/**
 * @file tabComponents.test.ts
 * @description 标签页书签与分类的键盘排序、焦点归还、只读访客和减少动态效果回归
 * @author TixXin
 * @since 2026-10-18
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useState } from '#app'
import TabBookmarkGrid from '../../app/components/tab/TabBookmarkGrid.vue'
import TabBookmarkItem from '../../app/components/tab/TabBookmarkItem.vue'
import TabSidebarFloating from '../../app/components/tab/TabSidebarFloating.vue'
import { TAB_SETTINGS_DEFAULTS } from '../../app/composables/useTabSettings'
import type { TabSettings } from '../../app/composables/useTabSettings'
import type { Bookmark, BookmarkCategory } from '../../app/features/tab/types'

const mocks = vi.hoisted(() => ({
  settings: { value: {} } as Ref<TabSettings>,
  start: vi.fn(),
  stop: vi.fn(),
  option: vi.fn(),
}))
mockNuxtImport('useTabSettings', () => () => ({ settings: mocks.settings }))
// 仅替换指针排序库；键盘事件、父组件回写和真实书签节点都保留。
vi.mock('@vueuse/integrations/useSortable', () => ({
  useSortable: () => ({ start: mocks.start, stop: mocks.stop, option: mocks.option }),
}))

const mounted: { unmount(): void }[] = []
const hosts: HTMLElement[] = []

function mountHost() {
  const host = document.createElement('div')
  document.body.append(host)
  hosts.push(host)
  return host
}

function createBookmarks(): Bookmark[] {
  return ['Vue 文档', 'Nuxt 文档', 'TypeScript 手册'].map((name, index) => ({
    id: `bookmark-${index + 1}`,
    userId: 'owner',
    name,
    url: `https://example.com/docs/${index + 1}`,
    icon: 'lucide:book-open',
    categoryId: 'category-1',
    sortOrder: (index + 1) * 100,
    description: `${name}的官方学习资料`,
  }))
}

function createCategories(): BookmarkCategory[] {
  return ['开发文档', '阅读清单', '设计参考'].map((name, index) => ({
    id: `category-${index + 1}`,
    userId: 'owner',
    name,
    icon: 'lucide:folder',
    color: '#64748b',
    sortOrder: (index + 1) * 100,
  }))
}

async function mountGrid(readOnly = false) {
  const wrapper = await mountSuspended(TabBookmarkGrid, {
    attachTo: mountHost(),
    props: { bookmarks: createBookmarks(), readOnly },
    global: { stubs: { Icon: true }, components: { TabBookmarkItem } },
  })
  mounted.push(wrapper)
  return wrapper
}

async function mountSidebar(readOnly = false) {
  const wrapper = await mountSuspended(TabSidebarFloating, {
    attachTo: mountHost(),
    props: {
      user: null,
      categories: createCategories(),
      activeId: 'category-1',
      counts: { 'category-1': 3, 'category-2': 1 },
      totalCount: 4,
      readOnly,
    },
    global: { stubs: { Icon: true, CommonTooltip: { template: '<div><slot /></div>' } } },
  })
  mounted.push(wrapper)
  return wrapper
}

async function mountReorderingGrid() {
  const bookmarks = ref(createBookmarks())
  const parent = await mountSuspended(
    defineComponent({
      setup: () => () =>
        h(TabBookmarkGrid, {
          bookmarks: bookmarks.value,
          onReorder: async (updates) => {
            // 与 useTabBookmarks 一致，等待本地仓库返回的已完成 Promise 后回写。
            await Promise.resolve()
            bookmarks.value = updates.map((update) => ({
              ...bookmarks.value.find((bookmark) => bookmark.id === update.id)!,
              ...update,
            }))
          },
        }),
    }),
    { attachTo: mountHost(), global: { stubs: { Icon: true }, components: { TabBookmarkItem } } },
  )
  mounted.push(parent)
  return parent.getComponent(TabBookmarkGrid)
}

async function mountReorderingSidebar() {
  const categories = ref(createCategories())
  const parent = await mountSuspended(
    defineComponent({
      setup: () => () =>
        h(TabSidebarFloating, {
          user: null,
          categories: categories.value,
          activeId: 'category-1',
          counts: {},
          totalCount: 0,
          onReorderCategories: async (updates) => {
            await Promise.resolve()
            categories.value = updates.map((update) => ({
              ...categories.value.find((category) => category.id === update.id)!,
              ...update,
            }))
          },
        }),
    }),
    { attachTo: mountHost(), global: { stubs: { Icon: true } } },
  )
  mounted.push(parent)
  return parent.getComponent(TabSidebarFloating)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.settings = ref({ ...TAB_SETTINGS_DEFAULTS })
  useState('motion-reduced').value = false
})

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  hosts.splice(0).forEach((host) => host.remove())
})

describe('书签键盘排序', () => {
  it.each([
    { key: 'ArrowUp', order: [2, 1, 3] },
    { key: 'ArrowDown', order: [1, 3, 2] },
  ])('Alt＋$key 调整顺序、保留分类并归还当前书签焦点', async ({ key, order }) => {
    const wrapper = await mountReorderingGrid()
    const original = wrapper.props('bookmarks')
    const bookmark = wrapper.get<HTMLAnchorElement>('[data-bookmark-id="bookmark-2"]')
    bookmark.element.focus()
    await bookmark.trigger('keydown', { key, altKey: true })

    expect(wrapper.emitted('reorder')).toEqual([
      [
        order.map((id, index) => ({
          id: `bookmark-${id}`,
          categoryId: 'category-1',
          sortOrder: (index + 1) * 100,
        })),
      ],
    ])
    expect(original).toEqual(createBookmarks())
    await flushPromises()
    expect(wrapper.findAll('[data-bookmark-id]').map((node) => node.attributes('data-bookmark-id'))).toEqual(
      order.map((id) => `bookmark-${id}`),
    )
    expect(document.activeElement).toBe(wrapper.get('[data-bookmark-id="bookmark-2"]').element)
    expect(wrapper.emitted('remove')).toBeUndefined()
    expect(wrapper.emitted('contextMenu')).toBeUndefined()
  })

  it('边界方向和未按 Alt 的方向键均不触发排序', async () => {
    const wrapper = await mountGrid()
    await wrapper.get('[data-bookmark-id="bookmark-1"]').trigger('keydown', { key: 'ArrowUp', altKey: true })
    await wrapper.get('[data-bookmark-id="bookmark-3"]').trigger('keydown', { key: 'ArrowDown', altKey: true })
    await wrapper.get('[data-bookmark-id="bookmark-2"]').trigger('keydown', { key: 'ArrowUp' })
    await wrapper.get('[data-bookmark-id="bookmark-2"]').trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.emitted('reorder')).toBeUndefined()
    expect(wrapper.props('bookmarks')).toEqual(createBookmarks())
  })

  it('关闭指针拖拽后仍可使用键盘替代，并保留操作提示', async () => {
    mocks.settings.value.dragEnabled = false
    const wrapper = await mountGrid()
    expect(mocks.stop).toHaveBeenCalled()
    expect(mocks.start).not.toHaveBeenCalled()
    expect(wrapper.get('.tab-grid__hint').text()).toContain('Alt＋上/下方向键')
    await wrapper.get('[data-bookmark-id="bookmark-2"]').trigger('keydown', { key: 'ArrowUp', altKey: true })
    expect(wrapper.emitted('reorder')).toHaveLength(1)
  })

  it('只读状态实时变化后阻止键盘修改并发出访客提示事件', async () => {
    const wrapper = await mountGrid()
    await wrapper.setProps({ readOnly: true })
    await wrapper.get('[data-bookmark-id="bookmark-2"]').trigger('keydown', { key: 'ArrowDown', altKey: true })
    expect(wrapper.emitted('reorder')).toBeUndefined()
    expect(wrapper.emitted('readOnlyBlocked')).toEqual([[]])
    expect(wrapper.props('bookmarks')).toEqual(createBookmarks())
  })
})

describe('只读访客书签', () => {
  it.each(['grid', 'compact', 'list', 'cards'] as const)('%s 视图保留链接并隐藏新增、删除和排序提示', async (mode) => {
    mocks.settings.value.viewMode = mode
    const wrapper = await mountGrid(true)
    const links = wrapper.findAll<HTMLAnchorElement>('a.tab-bm')
    expect(links).toHaveLength(3)
    expect(wrapper.find('.tab-grid__add').exists()).toBe(false)
    expect(wrapper.find('.tab-bm__remove').exists()).toBe(false)
    expect(wrapper.find('.tab-grid__hint').exists()).toBe(false)
    links.forEach((link, index) => {
      expect(link.attributes('href')).toBe(createBookmarks()[index]!.url)
      expect(link.attributes('target')).toBe('_blank')
      expect(link.attributes('rel')).toContain('noopener')
      expect(link.attributes('title')).toContain(createBookmarks()[index]!.name)
      link.element.focus()
      expect(document.activeElement).toBe(link.element)
    })

    await links[0]!.trigger('contextmenu', { clientX: 20, clientY: 30 })
    const setData = vi.fn()
    await links[0]!.trigger('dragstart', { dataTransfer: { setData } })
    await links[0]!.trigger('keydown', { key: 'ArrowDown', altKey: true })
    expect(setData).not.toHaveBeenCalled()
    expect(wrapper.emitted('contextMenu')).toBeUndefined()
    expect(wrapper.emitted('reorder')).toBeUndefined()
    expect(wrapper.emitted('readOnlyBlocked')).toEqual([[]])
    expect(wrapper.props('bookmarks')).toEqual(createBookmarks())
  })

  it('可编辑模式的新增、删除和右键操作保留原始事件载荷', async () => {
    const wrapper = await mountGrid()
    await wrapper.get('.tab-grid__add').trigger('click')
    await wrapper.get('button[aria-label="删除 Vue 文档"]').trigger('click')
    await wrapper.get('[data-bookmark-id="bookmark-2"]').trigger('contextmenu', { clientX: 21, clientY: 34 })
    expect(wrapper.emitted('add')).toEqual([[]])
    expect(wrapper.emitted('remove')).toEqual([['bookmark-1']])
    expect(wrapper.emitted('contextMenu')).toEqual([[{ bookmark: createBookmarks()[1], x: 21, y: 34 }]])
  })
})

describe('分类键盘排序与访客浏览', () => {
  it.each([
    { key: 'ArrowUp', order: [2, 1, 3] },
    { key: 'ArrowDown', order: [1, 3, 2] },
  ])('Alt＋$key 发出分类排序并在回写后保留焦点', async ({ key, order }) => {
    const wrapper = await mountReorderingSidebar()
    const original = wrapper.props('categories')
    const category = wrapper.get<HTMLButtonElement>('[data-category-id="category-2"]')
    category.element.focus()
    await category.trigger('keydown', { key, altKey: true })
    expect(wrapper.emitted('reorderCategories')).toEqual([
      [order.map((id, index) => ({ id: `category-${id}`, sortOrder: (index + 1) * 100 }))],
    ])
    expect(original).toEqual(createCategories())
    await flushPromises()
    expect(wrapper.findAll('[data-category-id]').map((node) => node.attributes('data-category-id'))).toEqual(
      order.map((id) => `category-${id}`),
    )
    expect(document.activeElement).toBe(wrapper.get('[data-category-id="category-2"]').element)
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('分类边界与普通方向键不发出排序，关闭拖拽仍保留键盘替代', async () => {
    mocks.settings.value.dragEnabled = false
    const wrapper = await mountSidebar()
    expect(mocks.stop).toHaveBeenCalled()
    expect(mocks.start).not.toHaveBeenCalled()
    await wrapper.get('[data-category-id="category-1"]').trigger('keydown', { key: 'ArrowUp', altKey: true })
    await wrapper.get('[data-category-id="category-3"]').trigger('keydown', { key: 'ArrowDown', altKey: true })
    await wrapper.get('[data-category-id="category-2"]').trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.emitted('reorderCategories')).toBeUndefined()
    await wrapper.get('[data-category-id="category-2"]').trigger('keydown', { key: 'ArrowDown', altKey: true })
    expect(wrapper.emitted('reorderCategories')).toHaveLength(1)
  })

  it('访客可筛选分类，折叠后仍有名称和计数，但不可新增或排序', async () => {
    const wrapper = await mountSidebar(true)
    expect(mocks.stop).toHaveBeenCalled()
    expect(mocks.start).not.toHaveBeenCalled()
    expect(wrapper.find('.tab-side__action').exists()).toBe(false)
    expect(wrapper.get('[data-category-id="category-1"]').attributes('aria-pressed')).toBe('true')
    const category = wrapper.get('[data-category-id="category-2"]')
    expect(category.attributes('aria-label')).toBe('阅读清单，1 个书签')
    await category.trigger('click')
    expect(wrapper.emitted('select')).toEqual([['category-2']])
    await wrapper.setProps({ activeId: 'category-2', collapsed: true })
    expect(category.attributes('aria-pressed')).toBe('true')
    expect(category.attributes('aria-label')).toBe('阅读清单，1 个书签')
    expect(category.attributes('title')).toBe('阅读清单')
    expect(wrapper.find('.tab-side__action').exists()).toBe(false)
    await category.trigger('keydown', { key: 'ArrowUp', altKey: true })
    await category.trigger('keydown', { key: 'ArrowDown', altKey: true })
    expect(wrapper.emitted('reorderCategories')).toBeUndefined()
    expect(wrapper.emitted('addCategory')).toBeUndefined()
    expect(wrapper.props('categories')).toEqual(createCategories())
  })
})

describe('排序动效偏好', () => {
  it.each(['bookmarks', 'categories'])('%s 随减少动态效果偏好切换 Sortable 动画时长', async (target) => {
    useState('motion-reduced').value = true
    if (target === 'bookmarks') await mountGrid()
    else await mountSidebar()
    expect(mocks.option).toHaveBeenLastCalledWith('animation', 0)
    useState('motion-reduced').value = false
    await nextTick()
    expect(mocks.option).toHaveBeenLastCalledWith('animation', 150)
  })
})
