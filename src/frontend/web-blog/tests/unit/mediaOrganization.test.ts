/** @file mediaOrganization.test.ts @description 挂载真实媒体选择列表，验证素材说明、服务端筛选和未保存保护。 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import MediaLibrary from '../../app/components/admin/MediaLibrary.vue'
import { useMediaLibrary } from '../../app/composables/useMediaLibrary'

const mocks = vi.hoisted(() => ({ api: vi.fn(), actor: { id: 'media-owner' }, cancel: vi.fn() }))
mockNuxtImport('useCurrentUser', () => () => ({ currentUser: ref(mocks.actor), restore: async () => true }))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useMediaUpload', () => () => ({ upload: vi.fn(), cancel: mocks.cancel }))
mockNuxtImport('useToast', () => () => ({ success: vi.fn() }))
mockNuxtImport('onBeforeRouteLeave', () => () => undefined)
mockNuxtImport('onBeforeRouteUpdate', () => () => undefined)
const asset = {
  id: 'media-a',
  name: '山间晨光.webp',
  url: '/image.webp',
  alt: '山谷中的晨光',
  description: '用于文章封面',
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
async function setup(selectable = true, route = '/admin/media') {
  let state!: ReturnType<typeof useMediaLibrary>
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        state = useMediaLibrary(selectable)
        return () => h(MediaLibrary, { selectable, controller: state })
      },
    }),
    { route, global: { stubs: { Icon: true } } },
  )
  wrappers.push(wrapper)
  await flushPromises()
  return { wrapper, state }
}
it('实际媒体选择器展示独立说明和构图、使用状态筛选', async () => {
  const { wrapper } = await setup()
  expect(wrapper.get('textarea[aria-label="山间晨光.webp 素材说明"]').element).toBeTruthy()
  expect(wrapper.get('select[aria-label="媒体构图"]').exists()).toBe(true)
  expect(wrapper.get('select[aria-label="媒体使用状态"]').exists()).toBe(true)
})

it('构图与使用条件进入服务端分页请求，选择器不拉全量资源', async () => {
  const { state } = await setup()
  state.orientation.value = 'portrait'
  state.usage.value = 'unused'
  state.search.value = '晨光'
  await state.searchMedia()
  expect(mocks.api).toHaveBeenLastCalledWith('/admin/media', {
    query: { page: 1, pageSize: 20, search: '晨光', deleted: 'false', orientation: 'portrait', usage: 'unused' },
  })
  await state.changePage(2)
  expect(mocks.api).toHaveBeenLastCalledWith('/admin/media', {
    query: { page: 2, pageSize: 20, search: '晨光', deleted: 'false', orientation: 'portrait', usage: 'unused' },
  })
  expect(state.total.value).toBe(21)
})

it('素材说明未保存时阻止翻页和选择，保存只提交该字段且不覆盖替代文本', async () => {
  const { state } = await setup()
  const current = state.items.value[0]!
  state.descriptionDrafts[current.id] = '山间晨光的出处与使用位置'
  expect(state.hasDirtyAlt.value).toBe(false)
  expect(state.hasDirtyDescription.value).toBe(true)
  expect(state.canSelect(current)).toBe(false)
  await state.changePage(2)
  expect(state.page.value).toBe(1)
  expect(mocks.api).toHaveBeenCalledTimes(1)
  mocks.api.mockResolvedValueOnce({ ...asset, description: '山间晨光的出处与使用位置' })
  await state.saveDescription(current)
  expect(mocks.api).toHaveBeenLastCalledWith('/admin/media/media-a', {
    method: 'PATCH',
    body: { description: '山间晨光的出处与使用位置' },
  })
  expect(current.alt).toBe(asset.alt)
  expect(state.hasDirtyMetadata.value).toBe(false)
  expect(state.error.value).toBe('')
  expect(state.canSelect(current)).toBe(true)
})

it('说明保存失败保留输入，迟到成功不覆盖等待期间的新输入', async () => {
  const { state } = await setup()
  const current = state.items.value[0]!
  state.descriptionDrafts[current.id] = '尚未保存的说明'
  mocks.api.mockRejectedValueOnce(new Error('断网'))
  await state.saveDescription(current)
  expect(state.descriptionDrafts[current.id]).toBe('尚未保存的说明')
  expect(state.error.value).toContain('输入已保留')
  let finish!: (value: unknown) => void
  mocks.api.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const saving = state.saveDescription(current)
  state.descriptionDrafts[current.id] = '等待期间更新的说明'
  finish({ ...asset, description: '尚未保存的说明' })
  await saving
  expect(state.descriptionDrafts[current.id]).toBe('等待期间更新的说明')
  expect(state.savedDescriptions[current.id]).toBe('尚未保存的说明')
  expect(state.hasDirtyMetadata.value).toBe(true)
})

it('素材说明未保存时刷新或关闭页面会请求保留输入，取消修改后解除保护', async () => {
  const { state } = await setup()
  state.descriptionDrafts[asset.id] = '尚未提交的素材说明'
  const dirty = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(dirty)
  expect(dirty.defaultPrevented).toBe(true)
  state.descriptionDrafts[asset.id] = asset.description
  const clean = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(clean)
  expect(clean.defaultPrevented).toBe(false)
})

it('独立媒体页恢复地址中的筛选与分页，嵌入选择器不会借用编辑页查询条件', async () => {
  const standalone = await setup(false, '/admin/media?orientation=square&usage=used&page=2')
  expect(standalone.state.orientation.value).toBe('square')
  expect(standalone.state.usage.value).toBe('used')
  expect(standalone.state.page.value).toBe(2)
  const picker = await setup(true, '/admin/media?orientation=square&usage=used&page=2')
  expect(picker.state.orientation.value).toBe('')
  expect(picker.state.usage.value).toBe('')
  expect(picker.state.page.value).toBe(1)
})
