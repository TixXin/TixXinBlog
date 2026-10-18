/** @file searchRequestFeedback.test.ts @description 搜索页与弹层失败使用统一反馈，重试保留关键词、类型与页码。 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import SearchModal from '../../app/components/common/SearchModal.vue'
import SearchPage from '../../app/pages/search.vue'
import type { SearchSelection } from '../../app/features/search/types'

const mocks = vi.hoisted(() => ({
  links: vi.fn(),
  projects: vi.fn(),
  posts: vi.fn(),
  gallery: vi.fn(),
  moments: vi.fn(),
  flashes: vi.fn(),
}))
mockNuxtImport('useLinkRepository', () => () => ({ list: mocks.links }))
mockNuxtImport('useProjectRepository', () => () => ({ list: mocks.projects }))
mockNuxtImport('useGalleryRepository', () => () => ({ list: mocks.gallery }))
mockNuxtImport('useMomentRepository', () => () => ({ list: mocks.moments }))
mockNuxtImport('useFlashRepository', () => () => ({}))
mockNuxtImport('usePageSeo', () => () => {})
vi.mock('../../app/features/post/api', () => ({ fetchPostPage: mocks.posts }))
vi.mock('../../app/features/search/flash', () => ({ fetchFlashSearchPage: mocks.flashes }))

const wrappers: { unmount(): void }[] = []
const Frame = defineComponent({
  setup:
    (_props, { slots }) =>
    () =>
      h('main', [slots.header?.(), slots.default?.()]),
})
const Container = defineComponent({
  setup:
    (_props, { slots }) =>
    () =>
      h('div', slots.default?.()),
})
beforeEach(() => {
  vi.resetAllMocks()
  useRuntimeConfig().public.postUseMockRepo = false
  useRuntimeConfig().public.useMockRepo = false
  clearNuxtState('search-dialog-selection')
  for (const source of Object.values(mocks)) source.mockResolvedValue({ items: [], total: 0 })
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  clearNuxtState('search-dialog-selection')
})

it('弹层搜索失败后沿用单类型第 2 页，重试中不重复请求，成功后移除错误', async () => {
  useState<SearchSelection>('search-dialog-selection').value = { query: '窗边', type: 'gallery', page: 2 }
  mocks.gallery.mockRejectedValueOnce(new Error('图库读取中断'))
  const wrapper = await mountSuspended(SearchModal, {
    props: { visible: false },
    global: { stubs: { Teleport: true, Transition: false, Icon: true } },
  })
  wrappers.push(wrapper)
  await wrapper.setProps({ visible: true })
  await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('搜索加载失败')
  expect(wrapper.get('[role="alert"]').text()).toContain('图库搜索暂时不可用')
  expect(wrapper.text()).not.toContain('没有找到相关内容')
  expect(mocks.gallery).toHaveBeenCalledExactlyOnceWith({ q: '窗边', page: 2, pageSize: 10 }, expect.any(AbortSignal))

  let resolve!: (result: { items: { id: number; title: string; description: string }[]; total: number }) => void
  mocks.gallery.mockImplementationOnce(() => new Promise((done) => (resolve = done)))
  await wrapper.get('.request-feedback button').trigger('click')
  expect(wrapper.find('.request-feedback button').exists()).toBe(false)
  expect(mocks.gallery).toHaveBeenCalledTimes(2)
  expect(mocks.gallery).toHaveBeenLastCalledWith({ q: '窗边', page: 2, pageSize: 10 }, expect.any(AbortSignal))
  resolve({ items: [{ id: 21, title: '窗边光影', description: '午后的光' }], total: 21 })
  await flushPromises()
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  expect(wrapper.get('.search-modal__item-title').text()).toBe('窗边光影')
  expect(wrapper.get('input').element.value).toBe('窗边')
})

it('搜索页单一来源失败保留其他真实结果，并可从统一反馈重新读取相同查询', async () => {
  mocks.links.mockRejectedValueOnce(new Error('友链读取中断'))
  mocks.projects.mockResolvedValue({ items: [{ id: 8, title: '文档工作台', description: '整理资料' }], total: 1 })
  const wrapper = await mountSuspended(SearchPage, {
    route: '/search?q=文档',
    global: { stubs: { CommonPageFrame: Frame, CommonCustomScrollbar: Container, CommonPageHeader: true, Icon: true } },
  })
  wrappers.push(wrapper)
  await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('搜索加载失败')
  expect(wrapper.get('[role="alert"]').text()).toContain('友链搜索暂时不可用')
  expect(wrapper.get('[data-search-type="project"]').text()).toContain('文档工作台')
  expect(wrapper.get('[data-search-type="link"]').text()).not.toContain('当前条件下没有结果')
  await wrapper.get('.request-feedback button').trigger('click')
  await flushPromises()
  expect(mocks.links).toHaveBeenCalledTimes(2)
  expect(mocks.links).toHaveBeenLastCalledWith({ q: '文档', page: 1, pageSize: 3 }, expect.any(AbortSignal))
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  expect(wrapper.get('[data-search-type="project"]').text()).toContain('文档工作台')
})
