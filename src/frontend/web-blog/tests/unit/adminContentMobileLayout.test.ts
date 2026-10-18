/** @file adminContentMobileLayout.test.ts @description 后台内容页窄屏布局钩子、文章卡片字段与可键盘滚动的分类表格回归 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import PostsPage from '../../app/pages/admin/posts/index.vue'
import TaxonomyPage from '../../app/pages/admin/taxonomy.vue'
import FlashesPage from '../../app/pages/admin/flashes.vue'
import MomentsPage from '../../app/pages/admin/moments/index.vue'

const mocks = vi.hoisted(() => ({ api: vi.fn(), adminList: vi.fn() }))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useMomentRepository', () => () => ({ adminList: mocks.adminList }))
mockNuxtImport('useCurrentUser', () => () => ({
  currentUser: ref({ id: 'mobile-layout-owner' }),
  isLoggedIn: ref(true),
  restoringPending: ref(false),
  restore: async () => true,
}))
mockNuxtImport('useToast', () => () => ({ success: vi.fn(), error: vi.fn() }))
mockNuxtImport('onBeforeRouteLeave', () => () => undefined)
mockNuxtImport('onBeforeRouteUpdate', () => () => undefined)

const wrappers: { unmount(): void }[] = []
const longText = '不省略长内容与操作入口'.repeat(8)
const timestamp = '2026-10-18T00:00:00.000Z'
beforeEach(() => {
  mocks.api.mockReset()
  mocks.adminList.mockReset()
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.clearAllMocks()
})

it('文章列表保留窄屏卡片字段标签、独立表格容器与可重排筛选和批量栏', async () => {
  mocks.api.mockImplementation(async (path: string) => {
    if (path === '/admin/posts/filters') return { folders: [longText], tags: [longText] }
    if (path === '/admin/posts/batch') return []
    if (path === '/admin/posts')
      return {
        items: [
          {
            id: 1,
            revision: 1,
            deleted: false,
            title: longText,
            status: 'published',
            category: 'tech',
            folder: longText,
            tags: [longText],
            pinned: false,
            updatedAt: timestamp,
          },
        ],
        total: 1,
      }
    throw new Error(path)
  })
  const wrapper = await mountSuspended(PostsPage, {
    route: '/admin/posts',
    global: { stubs: { AdminPostBatch: true } },
  })
  wrappers.push(wrapper)
  await flushPromises()
  expect(wrapper.get('.admin-posts__filters input').attributes('aria-label')).toBe('搜索文章标题')
  expect(wrapper.findAll('.admin-posts__filters select')).toHaveLength(6)
  const table = wrapper.get('.admin-posts__table')
  expect(table.attributes('role')).toBe('region')
  expect(table.attributes('tabindex')).toBe('0')
  expect(table.attributes('aria-label')).toBe('文章列表，宽屏可横向滚动')
  expect(wrapper.get('.admin-posts__batch').text()).toContain('预览批量操作')
  expect(wrapper.findAll('.admin-posts__table tbody td').map((cell) => cell.attributes('data-label'))).toEqual([
    '标题',
    '状态',
    '分类与标签',
    '更新时间',
    '操作',
  ])
  expect(wrapper.get('.admin-posts__table tbody td').text()).toBe(longText)
  expect(wrapper.get('.admin-posts__pagination').text()).toContain('共 1 篇')
})

it('分类表格横向滚动区可聚焦且有独立名称，编辑字段继续保留在换行容器中', async () => {
  mocks.api.mockResolvedValue({
    categories: [],
    folders: [{ id: 1, label: longText, total: 2, published: 1 }],
    tags: [{ id: 2, label: longText, total: 0, published: 0 }],
  })
  const wrapper = await mountSuspended(TaxonomyPage, { route: '/admin/taxonomy', attachTo: document.body })
  wrappers.push(wrapper)
  await flushPromises()
  const tables = wrapper.findAll('.taxonomy__group .taxonomy__table')
  expect(tables).toHaveLength(2)
  expect(tables.map((table) => table.attributes('aria-label'))).toEqual([
    '专栏列表，可横向滚动',
    '标签列表，可横向滚动',
  ])
  for (const table of tables) {
    expect(table.attributes('role')).toBe('region')
    expect(table.attributes('tabindex')).toBe('0')
    expect(table.findAll('thead th')).toHaveLength(4)
    expect(table.get('tbody td').text()).toBe(longText)
  }
  const scrollRegion = tables[0]!.element as HTMLElement
  scrollRegion.focus()
  expect(document.activeElement).toBe(tables[0]!.element)
  expect(wrapper.findAll('.taxonomy__editor fieldset label')).toHaveLength(2)
})

it('闪念保留长标签与正文，筛选、卡片操作和时间信息使用各自的换行容器', async () => {
  mocks.api.mockResolvedValue({
    items: [
      {
        id: 'flash-mobile',
        content: longText,
        tags: [longText],
        comments: [],
        updatedAt: timestamp,
        isDraft: false,
        isArchived: false,
        isPinned: false,
      },
    ],
    total: 1,
  })
  const wrapper = await mountSuspended(FlashesPage, { route: '/admin/flashes' })
  wrappers.push(wrapper)
  await flushPromises()
  expect(wrapper.get('.admin-flashes__filters input').attributes('aria-label')).toBe('搜索闪念')
  expect(wrapper.get('.admin-flashes__list .admin-flashes__content').text()).toBe(longText)
  expect(wrapper.get('.admin-flashes__tags').text()).toBe(`#${longText}`)
  expect(wrapper.get('.admin-flashes__meta time').text()).not.toBe('')
  expect(wrapper.get('.admin-flashes__actions').text()).toContain('管理评论（0）')
})

it('朋友圈保留日期筛选及完整长话题，卡片操作和分页沿用可换行类名', async () => {
  mocks.adminList.mockResolvedValue({
    items: [
      {
        id: 'moment-mobile',
        content: longText,
        topics: [longText],
        status: 'published',
        updatedAt: timestamp,
        isPinned: false,
        revision: 1,
      },
    ],
    total: 16,
    page: 1,
  })
  const wrapper = await mountSuspended(MomentsPage, { route: '/admin/moments' })
  wrappers.push(wrapper)
  await flushPromises()
  expect(wrapper.get('.admin-moments__filters label input').attributes('type')).toBe('date')
  expect(wrapper.get('.admin-moments__list .admin-moments__content').text()).toBe(longText)
  expect(wrapper.get('.admin-moments__list li').text()).toContain(`#${longText}`)
  expect(wrapper.get('.admin-moments__list .admin-moments__actions').text()).toContain('管理评论')
  expect(wrapper.get('nav.admin-moments__actions').attributes('aria-label')).toBe('管理动态分页')
})
