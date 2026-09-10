/** @file galleryFeed.test.ts @description 图库公开读取失败保留列表，已撤回作品不继续使用旧灯箱缓存 */
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useGallery } from '../../app/composables/useGallery'
const mocks = vi.hoisted(() => ({ list: vi.fn(), metadata: vi.fn(), detail: vi.fn(), navigation: vi.fn() }))
mockNuxtImport('useGalleryRepository', () => () => mocks)
const item = {
  id: 1,
  title: '城市的倒影',
  description: '',
  src: '/photo.webp',
  srcLarge: '/photo.webp',
  category: '城市',
  date: '',
  location: '',
}
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  mocks.list.mockReset().mockResolvedValue({ items: [item], total: 1, page: 1, pageSize: 12 })
  mocks.detail.mockReset().mockResolvedValue(item)
  mocks.navigation
    .mockReset()
    .mockResolvedValue({ matched: true, page: 1, previousId: null, nextId: null, previousPage: null, nextPage: null })
  mocks.metadata.mockReset().mockResolvedValue({
    categories: [{ label: '城市', value: '城市', count: 1 }],
    stats: { photos: 1, categories: 1, locations: 0 },
    gear: [],
  })
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
async function setup() {
  let state!: Awaited<ReturnType<typeof useGallery>>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        async setup() {
          clearNuxtData(['gallery-feed', 'gallery-metadata'])
          state = await useGallery()
          return () => h('div')
        },
      }),
      { route: '/gallery' },
    ),
  )
  return state
}
it('刷新读取失败保留真实成功列表，重试更新统计而不伪造空集合', async () => {
  const state = await setup()
  expect(state.photos.value).toHaveLength(1)
  mocks.list.mockRejectedValueOnce(new Error('读取中断'))
  await state.refresh()
  expect(state.error.value?.message).toBe('读取中断')
  expect(state.photos.value).toHaveLength(1)
  expect(state.total.value).toBe(1)
  mocks.list.mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 12 })
  await state.refresh()
  expect(state.error.value).toBeUndefined()
  expect(state.total.value).toBe(0)
})
it('灯箱公开详情返回不可见后清除已读卡片作为预览的后备', async () => {
  const state = await setup()
  mocks.detail.mockRejectedValueOnce(Object.assign(new Error('作品不存在或尚未公开'), { statusCode: 404 }))
  await state.open(item)
  await vi.waitFor(() => expect(state.detailError.value).toBe('作品不存在或尚未公开'))
  expect(state.selectedPhoto.value).toBeNull()
  expect(state.photos.value).toHaveLength(1)
  await state.readSelection()
  expect(state.selectedPhoto.value?.id).toBe(1)
})
it('深链作品定位真实页，导航通过同一筛选返回的相邻页切图', async () => {
  const state = await setup()
  mocks.navigation.mockResolvedValueOnce({
    matched: true,
    page: 3,
    previousId: 8,
    nextId: 6,
    previousPage: 2,
    nextPage: 3,
  })
  await state.open(item)
  await vi.waitFor(() => expect(state.query.value.page).toBe(3))
  expect(state.canPrevious.value).toBe(true)
  mocks.detail.mockResolvedValueOnce({ ...item, id: 8 })
  mocks.navigation.mockResolvedValueOnce({
    matched: true,
    page: 2,
    previousId: 9,
    nextId: 1,
    previousPage: 2,
    nextPage: 3,
  })
  await state.move(-1)
  await vi.waitFor(() => expect(state.selectedPhoto.value?.id).toBe(8))
  expect(state.query.value.page).toBe(2)
})
