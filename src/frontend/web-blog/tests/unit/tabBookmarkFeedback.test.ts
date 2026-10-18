/** @file tabBookmarkFeedback.test.ts @description 书签初次读取失败可统一重试，排序未保存仍保留原文提示。 */
import { afterEach, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import TabsPage from '../../app/pages/tabs.vue'
import RequestFeedback from '../../app/components/common/RequestFeedback.vue'

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  error: null as ReturnType<typeof ref<string | null>> | null,
  loaded: null as ReturnType<typeof ref<boolean>> | null,
  loading: null as ReturnType<typeof ref<boolean>> | null,
}))
mockNuxtImport('useTabRepository', () => () => ({}))
mockNuxtImport('useTabBookmarks', () => () => ({
  error: mocks.error,
  loaded: mocks.loaded,
  loading: mocks.loading,
  categories: ref([]),
  bookmarks: ref([]),
  visibleBookmarks: ref([]),
  categoryCounts: ref({}),
  activeCategoryId: ref(null),
  isReadOnly: ref(true),
  load: mocks.load,
  selectCategory: vi.fn(),
  addBookmark: vi.fn(),
  updateBookmark: vi.fn(),
  removeBookmark: vi.fn(),
  addCategory: vi.fn(),
  removeCategory: vi.fn(),
  reorderBookmarks: vi.fn(),
  reorderCategories: vi.fn(),
  refreshFavicon: vi.fn(),
}))

const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

function reset(error: string | null, loaded = false) {
  mocks.error = ref(error)
  mocks.loaded = ref(loaded)
  mocks.loading = ref(false)
  mocks.load.mockReset()
}

async function mountPage() {
  const wrapper = await mountSuspended(TabsPage, {
    shallow: true,
    global: { stubs: { CommonRequestFeedback: RequestFeedback, Icon: true } },
  })
  wrappers.push(wrapper)
  return wrapper
}

it('书签读取失败可重试，加载中不重复请求，恢复后移除反馈', async () => {
  reset('存储不可用')
  // 页面挂载时会自动 load()。这次保持失败状态，手动重试才进入加载。
  mocks.load.mockResolvedValue(undefined)
  const wrapper = await mountPage()
  await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('书签加载失败')
  expect(wrapper.get('[role="alert"]').text()).toContain('存储不可用')

  let finish!: () => void
  mocks.load.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        mocks.loading!.value = true
        mocks.error!.value = null
        finish = () => {
          mocks.loading!.value = false
          mocks.loaded!.value = true
          resolve()
        }
      }),
  )
  const callsBeforeRetry = mocks.load.mock.calls.length
  await wrapper.get('.request-feedback button').trigger('click')
  expect(mocks.load).toHaveBeenLastCalledWith(true)
  expect(mocks.load.mock.calls.length).toBe(callsBeforeRetry + 1)
  expect(wrapper.get('[role="status"]').text()).toContain('正在加载')
  await wrapper.get('.request-feedback button').trigger('click')
  expect(mocks.load.mock.calls.length).toBe(callsBeforeRetry + 1)
  finish()
  await flushPromises()
  expect(wrapper.find('.request-feedback').exists()).toBe(false)
})

it('排序未保存仍用原文提示，不换成读取重试', async () => {
  reset('书签排序未保存，浏览器存储不可用或空间不足。', true)
  const wrapper = await mountPage()
  expect(wrapper.find('.request-feedback').exists()).toBe(false)
  expect(wrapper.get('[role="alert"]').text()).toContain('书签排序未保存')
})
