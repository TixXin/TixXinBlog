/** @file adminCollectionMobileLayout.test.ts @description 图库、友链和项目列表保留窄屏可换行的筛选、卡片操作与分页 */
import { afterEach, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import GalleryPage from '../../app/pages/admin/gallery/index.vue'
import LinksPage from '../../app/pages/admin/links/index.vue'
import ProjectsPage from '../../app/pages/admin/projects/index.vue'

const mocks = vi.hoisted(() => ({
  gallery: vi.fn(),
  links: vi.fn(),
  projects: vi.fn(),
}))
mockNuxtImport('useCurrentUser', () => () => ({
  currentUser: ref({ id: 'collection-layout-owner' }),
  isLoggedIn: ref(true),
  restoringPending: ref(false),
  restore: async () => true,
}))
mockNuxtImport('useGalleryRepository', () => () => ({
  adminList: mocks.gallery,
  update: vi.fn(),
  remove: vi.fn(),
}))
mockNuxtImport('useLinkRepository', () => () => ({
  adminList: mocks.links,
  update: vi.fn(),
  remove: vi.fn(),
}))
mockNuxtImport('useProjectRepository', () => () => ({
  adminList: mocks.projects,
  update: vi.fn(),
  remove: vi.fn(),
}))

const wrappers: { unmount(): void }[] = []
const longText = '不换行就会溢出容器的名称'.repeat(6)
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.clearAllMocks()
})

it('图库筛选、作品操作和分页使用可换行容器，并保留长标题', async () => {
  mocks.gallery.mockResolvedValue({
    items: [
      {
        id: 1,
        title: longText,
        description: '晨雾中的栈道',
        src: '/fog.webp',
        srcLarge: '/fog.webp',
        width: 800,
        height: 600,
        category: '风景',
        date: '2026-10-01',
        location: '山间',
        source: 'external',
        mediaId: null,
        externalUrl: `https://example.com/${longText}`,
        status: 'published',
        sortOrder: 2,
        revision: 1,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      },
    ],
    total: 13,
    page: 1,
    pageSize: 12,
  })
  const wrapper = await mountSuspended(GalleryPage, {
    route: '/admin/gallery',
    global: { stubs: { CommonImageFrame: true, Icon: true } },
  })
  wrappers.push(wrapper)
  await flushPromises()
  const filters = wrapper.get('.admin-gallery__filters')
  expect(filters.get('input').attributes('aria-label')).toBe('搜索作品')
  expect(filters.findAll('select')).toHaveLength(1)
  expect(filters.text()).toContain('清除筛选')
  expect(wrapper.get('.admin-gallery__list .admin-gallery__actions').text()).toContain('编辑作品')
  expect(wrapper.get('.admin-gallery__list h2').text()).toBe(longText)
  expect(wrapper.get('nav[aria-label="管理图库分页"]').classes()).toContain('admin-gallery__actions')
})

it('友链筛选、卡片操作和分页可换行，长地址留在卡片内', async () => {
  mocks.links.mockResolvedValue({
    items: [
      {
        id: 2,
        name: longText,
        description: '记录同一条路线的站点',
        url: `https://example.com/${longText}`,
        domain: 'example.com',
        avatar: null,
        width: null,
        height: null,
        isFeatured: true,
        publishedAt: '2026-10-01T00:00:00.000Z',
        logoMediaId: null,
        logoUrl: null,
        status: 'published',
        sortOrder: 3,
        revision: 1,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      },
    ],
    total: 13,
    page: 1,
    pageSize: 12,
  })
  const wrapper = await mountSuspended(LinksPage, { route: '/admin/links' })
  wrappers.push(wrapper)
  await flushPromises()
  expect(wrapper.get('.admin-links__filters input').attributes('aria-label')).toBe('搜索管理友链')
  expect(wrapper.findAll('.admin-links__filters select')).toHaveLength(2)
  const row = wrapper.get('.admin-links__list li')
  expect(row.get('h2').text()).toBe(longText)
  expect(row.get('.admin-links__url').text()).toContain(longText)
  expect(row.get('.admin-links__actions').text()).toContain('编辑友链')
  expect(wrapper.get('nav[aria-label="管理友链分页"]').classes()).toContain('admin-links__actions')
})

it('项目筛选、卡片操作和分页可换行，长标题与技术标签保持完整', async () => {
  mocks.projects.mockResolvedValue({
    items: [
      {
        id: 3,
        title: longText,
        description: '把本地笔记整理成可检索的项目页',
        cover: null,
        width: null,
        height: null,
        progress: 'active',
        tags: [{ label: longText, color: 'emerald' }],
        links: [],
        status: 'draft',
        sortOrder: 1,
        revision: 1,
        coverMediaId: null,
        publishedAt: null,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      },
    ],
    total: 13,
    page: 1,
    pageSize: 12,
  })
  const wrapper = await mountSuspended(ProjectsPage, {
    route: '/admin/projects',
    global: { stubs: { Icon: true } },
  })
  wrappers.push(wrapper)
  await flushPromises()
  expect(wrapper.get('.admin-projects__filters input').attributes('aria-label')).toBe('搜索管理项目')
  expect(wrapper.findAll('.admin-projects__filters select')).toHaveLength(2)
  const row = wrapper.get('.admin-projects__list li')
  expect(row.get('h2').text()).toBe(longText)
  expect(row.text()).toContain(longText)
  expect(row.get('.admin-projects__actions').text()).toContain('编辑项目')
  expect(wrapper.get('nav[aria-label="管理项目分页"]').classes()).toContain('admin-projects__actions')
})
