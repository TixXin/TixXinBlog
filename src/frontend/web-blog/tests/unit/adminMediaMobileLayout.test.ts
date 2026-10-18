/** @file adminMediaMobileLayout.test.ts @description 媒体后台与选择器保留窄屏重排、长文件名换行和分页容器。 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import MediaLibrary from '../../app/components/admin/MediaLibrary.vue'
import MediaPicker from '../../app/components/admin/MediaPicker.vue'
import MediaPage from '../../app/pages/admin/media.vue'
import { useMediaLibrary } from '../../app/composables/useMediaLibrary'
import type { MediaAsset } from '../../app/features/media/types'

const mocks = vi.hoisted(() => ({ api: vi.fn(), actor: { id: 'media-layout-owner' } }))
mockNuxtImport('useCurrentUser', () => () => ({ currentUser: ref(mocks.actor), restore: async () => true }))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useMediaUpload', () => () => ({ upload: vi.fn(), cancel: vi.fn() }))
mockNuxtImport('useToast', () => () => ({ success: vi.fn() }))
mockNuxtImport('onBeforeRouteLeave', () => () => undefined)
mockNuxtImport('onBeforeRouteUpdate', () => () => undefined)

const asset: MediaAsset = {
  id: 'media-mobile',
  name: 'mountain-morning-light-with-an-uninterrupted-long-original-filename.webp',
  url: '/image.webp',
  alt: '山间晨光',
  description: '山谷中的晨光，用于文章封面',
  width: 900,
  height: 600,
  byteSize: 1000,
  mimeType: 'image/webp',
  createdAt: '2026-09-11T00:00:00Z',
  deleted: false,
}
const wrappers: { unmount(): void }[] = []

beforeEach(() => mocks.api.mockReset().mockResolvedValue({ items: [{ ...asset }], total: 21 }))
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})

async function setup(selectable = false) {
  let state!: ReturnType<typeof useMediaLibrary>
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        state = useMediaLibrary(selectable)
        return () => h(MediaLibrary, { selectable, controller: state })
      },
    }),
    { route: '/admin/media', global: { stubs: { Icon: true } } },
  )
  wrappers.push(wrapper)
  await flushPromises()
  return { wrapper, state }
}

it('媒体选择器工具栏在窄屏可换行，并保留关闭操作', async () => {
  const wrapper = await mountSuspended(MediaPicker, {
    props: { open: false },
    global: { stubs: { AdminMediaWorkspace: true } },
  })
  wrappers.push(wrapper)
  const toolbar = wrapper.get('header.media-picker__toolbar')
  expect(toolbar.get('h2').text()).toBe('选择媒体图片')
  expect(toolbar.get('button').text()).toBe('关闭媒体选择器')
})

it('媒体页提供可收缩的根容器并保留工作区', async () => {
  const wrapper = await mountSuspended(MediaPage, {
    global: { stubs: { AdminMediaWorkspace: true, ClientOnly: { template: '<slot />' } } },
  })
  wrappers.push(wrapper)
  expect(wrapper.get('section.admin-media').find('admin-media-workspace-stub').exists()).toBe(true)
})

it.each([false, true])('媒体库 selectable=%s 保留单列筛选和卡片操作布局挂钩', async (selectable) => {
  const { wrapper } = await setup(selectable)
  const filters = wrapper.get('.media-library__filters')
  expect(filters.element.tagName).toBe('FORM')
  expect(filters.get('input.media-library__search').attributes('aria-label')).toBe('搜索媒体')
  expect(filters.findAll('select')).toHaveLength(selectable ? 2 : 3)
  expect(filters.get('button[type="submit"]').text()).toBe('搜索')

  const card = wrapper.get('.media-library__grid > .media-library__card')
  expect(card.get('.media-library__asset-name').text()).toBe(asset.name)
  expect(card.findAll('.media-library__actions > button').map((button) => button.text())).toEqual([
    '保存替代文本',
    '保存素材说明',
    '查看引用',
    '移入回收',
    ...(selectable ? ['使用此图片'] : []),
  ])
  expect(card.get('textarea').attributes('aria-label')).toBe(`${asset.name} 素材说明`)
})

it('长上传文件名与引用使用独立换行区域，资源分页摘要独占一行', async () => {
  const { wrapper, state } = await setup()
  state.jobs.value = [{ id: 'upload-mobile', name: asset.name, alt: '', progress: 30, status: 'uploading', error: '' }]
  // 引用面板在选中资源后才显示，与媒体库的引用查看流程一致
  state.referenceId.value = asset.id
  state.references.value = {
    total: 21,
    page: 1,
    pageSize: 20,
    items: [{ kind: 'post', title: '山间晨光的摄影记录', url: '/admin/posts/morning' }],
  }
  await nextTick()

  expect(wrapper.get('.media-library__jobs .media-library__job-name').text()).toContain(asset.name)
  expect(wrapper.get('progress').attributes('aria-label')).toBe(`${asset.name} 上传进度`)
  const references = wrapper.get('.media-library__references')
  const headingId = references.attributes('aria-labelledby')
  expect(headingId).toBeTruthy()
  expect(references.get(`[id="${headingId}"]`).text()).toContain('引用位置')
  expect(references.findAll('.media-library__reference-pagination > button').map((button) => button.text())).toEqual([
    '上一页引用',
    '下一页引用',
  ])
  const pagination = wrapper.get('.media-library__pagination')
  expect(pagination.get('.media-library__page-summary').text()).toBe('1 / 2 · 共 21 项')
  expect(pagination.findAll('button')).toHaveLength(2)
})
