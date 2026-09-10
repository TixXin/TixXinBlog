/** @file galleryFeed.test.ts @description 图库公开读取失败保留列表，已撤回作品不继续使用旧灯箱缓存 */
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h, onMounted } from 'vue'
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
          clearNuxtData(['gallery-feed', 'gallery-metadata', 'gallery-selection'])
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
for (const serverSelected of [null, 22]) {
  it(`水合首帧保留SSR第2页和选中项${serverSelected ?? '无'}，挂载后才应用新历史查询`, async () => {
    let state!: Awaited<ReturnType<typeof useGallery>>, app!: ReturnType<typeof useNuxtApp>
    let priorHydrating = false,
      priorServerRendered: boolean | undefined,
      mounted = false
    const serverItem = { ...item, id: 22, title: 'SSR第二页照片' }
    const frames: { ready: boolean; page: number; ids: number[]; selected: number | null; photo: number | null }[] = []
    const requests: { page: number; mounted: boolean; hydrating: boolean }[] = []
    mocks.list.mockImplementation(async (query: { page: number }) => {
      requests.push({ page: query.page, mounted, hydrating: app.isHydrating })
      return { items: [item], total: 13, page: 1, pageSize: 12 }
    })
    try {
      const wrapper = await mountSuspended(
        defineComponent({
          async setup() {
            app = useNuxtApp()
            priorHydrating = app.isHydrating
            priorServerRendered = app.payload.serverRendered
            clearNuxtData(['gallery-feed', 'gallery-metadata', 'gallery-selection'])
            app.isHydrating = true
            app.payload.serverRendered = true
            app.payload.data['gallery-feed'] = {
              key: JSON.stringify({ page: 2, pageSize: 12 }),
              page: { items: [serverItem], total: 13, page: 2, pageSize: 12 },
            }
            app.payload.data['gallery-metadata'] = {
              categories: [],
              stats: { photos: 13, categories: 0, locations: 0 },
              gear: [],
            }
            app.payload.data['gallery-selection'] = {
              id: serverSelected,
              key: JSON.stringify({ pageSize: 12 }),
              item: serverSelected ? serverItem : null,
              navigation: serverSelected
                ? { matched: true, page: 2, previousId: 1, nextId: null, previousPage: 1, nextPage: null }
                : null,
            }
            onMounted(() => {
              mounted = true
            })
            state = await useGallery()
            expect(app.isHydrating).toBe(true)
            expect(mocks.list).not.toHaveBeenCalled()
            expect(mocks.detail).not.toHaveBeenCalled()
            return () => {
              frames.push({
                ready: state.ready.value,
                page: state.query.value.page,
                ids: state.photos.value.map((photo) => photo.id),
                selected: state.selectedId.value,
                photo: state.selectedPhoto.value?.id ?? null,
              })
              return h(
                'section',
                state.photos.value.map((photo) => h('article', { 'data-photo-id': photo.id }, photo.title)),
              )
            }
          },
        }),
        { route: serverSelected ? '/gallery?page=1&photo=1' : '/gallery?page=1' },
      )
      wrappers.push(wrapper)
      expect(frames[0]).toEqual({ ready: false, page: 2, ids: [22], selected: serverSelected, photo: serverSelected })
      await vi.waitFor(() => expect(state.photos.value.map((photo) => photo.id)).toEqual([1]))
      expect(requests).toEqual([{ page: 1, mounted: true, hydrating: true }])
      expect(state.query.value.page).toBe(1)
      if (serverSelected) {
        await vi.waitFor(() => expect(state.selectedPhoto.value?.id).toBe(1))
        expect(mocks.detail).toHaveBeenCalledExactlyOnceWith(1, expect.any(AbortSignal))
        expect(app.payload.data['gallery-selection'].id).toBe(1)
      } else {
        expect(state.selectedId.value).toBeNull()
        expect(mocks.detail).not.toHaveBeenCalled()
      }
      expect(wrapper.findAll('article').map((photo) => photo.attributes('data-photo-id'))).toEqual(['1'])
      expect(app.payload.data['gallery-feed'].key).toBe(JSON.stringify({ page: 1, pageSize: 12 }))
    } finally {
      if (app) {
        app.isHydrating = priorHydrating
        app.payload.serverRendered = priorServerRendered
      }
    }
  })
}
