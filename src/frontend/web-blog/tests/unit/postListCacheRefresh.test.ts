/** @file postListCacheRefresh.test.ts @description 连续流缓存过期后验证全部已显示前缀，不能只刷新末页 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { usePostList } from '../../app/composables/usePostList'
import { fetchPostPage } from '../../app/features/post/api'
import { mockPosts } from '../../app/features/post/mock'
import { publicReadCache } from '../../app/utils/publicReadCache'

vi.mock('../../app/features/post/api', () => ({ fetchPostPage: vi.fn() }))
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  publicReadCache(useNuxtApp()).invalidate(['posts'])
  clearNuxtData('post-list')
})
afterEach(async () => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  await nextTick()
  vi.restoreAllMocks()
})
async function mountList(page = ref(2)) {
  let list!: Awaited<ReturnType<typeof usePostList>>
  const wrapper = await mountSuspended(
    defineComponent({
      async setup() {
        list = await usePostList({
          page,
          selectedTag: ref(null),
          selectedCategory: ref(null),
          displayMode: ref('waterfall'),
        })
        return () => h('div')
      },
    }),
  )
  wrappers.push(wrapper)
  return { list, wrapper }
}

it('过期回访连续流后，第一页面已由其他会话撤回的文章必须移除', async () => {
  let now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  let catalog = Array.from({ length: 30 }, (_, index) => ({
    ...mockPosts[0]!,
    id: index + 1,
    title: `日常记录 ${index + 1}`,
  }))
  vi.mocked(fetchPostPage).mockImplementation(async (_base, query) => {
    const page = query?.page ?? 1
    return { items: catalog.slice((page - 1) * 15, page * 15), total: catalog.length, page, pageSize: 15 }
  })
  const first = await mountList()
  expect(first.list.posts.value.some((post) => post.id === 1)).toBe(true)
  first.wrapper.unmount()
  wrappers.pop()
  await nextTick()
  now += 31_000
  catalog = catalog.filter((post) => post.id !== 1)
  const second = await mountList()
  await flushPromises()
  expect(second.list.pending.value).toBe(false)
  expect(second.list.total.value).toBe(29)
  expect(second.list.posts.value.some((post) => post.id === 1)).toBe(false)
  expect(second.list.posts.value.map((post) => post.id)).toEqual(catalog.map((post) => post.id))
})

it('常规触底只追加新页，但同页手动刷新重建完整前缀与页边界', async () => {
  let catalog = Array.from({ length: 45 }, (_, index) => ({
    ...mockPosts[0]!,
    id: index + 1,
    title: `日常记录 ${index + 1}`,
  }))
  vi.mocked(fetchPostPage)
    .mockReset()
    .mockImplementation(async (_base, query) => {
      const page = query?.page ?? 1
      return { items: catalog.slice((page - 1) * 15, page * 15), total: catalog.length, page, pageSize: 15 }
    })
  const page = ref(1)
  const { list } = await mountList(page)
  expect(fetchPostPage).toHaveBeenCalledTimes(1)
  page.value = 2
  await vi.waitFor(() => expect(list.posts.value).toHaveLength(30))
  expect(vi.mocked(fetchPostPage).mock.calls.map((call) => call[1]?.page)).toEqual([1, 2])
  catalog = catalog.filter((post) => post.id !== 1)
  await list.refresh()
  expect(vi.mocked(fetchPostPage).mock.calls.map((call) => call[1]?.page)).toEqual([1, 2, 1, 2])
  expect(list.posts.value.map((post) => post.id)).toEqual(catalog.slice(0, 30).map((post) => post.id))
  expect(list.total.value).toBe(44)
})

it('追加只继承旧前缀剩余有效期，回访不能为旧记录重新续期30秒', async () => {
  let now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  let catalog = Array.from({ length: 45 }, (_, index) => ({
    ...mockPosts[0]!,
    id: index + 1,
    title: `日常记录 ${index + 1}`,
  }))
  vi.mocked(fetchPostPage)
    .mockReset()
    .mockImplementation(async (_base, query) => {
      const page = query?.page ?? 1
      return { items: catalog.slice((page - 1) * 15, page * 15), total: catalog.length, page, pageSize: 15 }
    })
  const page = ref(1)
  const first = await mountList(page)
  now += 20_000
  page.value = 2
  await vi.waitFor(() => expect(first.list.posts.value).toHaveLength(30))
  expect(vi.mocked(fetchPostPage).mock.calls.map((call) => call[1]?.page)).toEqual([1, 2])
  first.wrapper.unmount()
  wrappers.pop()
  await nextTick()
  now += 11_000
  catalog = catalog.filter((post) => post.id !== 1)
  const second = await mountList()
  await flushPromises()
  expect(vi.mocked(fetchPostPage).mock.calls.map((call) => call[1]?.page)).toEqual([1, 2, 1, 2])
  expect(second.list.posts.value.map((post) => post.id)).toEqual(catalog.slice(0, 30).map((post) => post.id))
})

it('页面未卸载但旧前缀已过期时，继续追加也重新核对前缀', async () => {
  let now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  const catalog = Array.from({ length: 45 }, (_, index) => ({ ...mockPosts[0]!, id: index + 1 }))
  vi.mocked(fetchPostPage)
    .mockReset()
    .mockImplementation(async (_base, query) => {
      const page = query?.page ?? 1
      return { items: catalog.slice((page - 1) * 15, page * 15), total: catalog.length, page, pageSize: 15 }
    })
  const page = ref(1)
  const { list } = await mountList(page)
  now += 31_000
  page.value = 2
  await vi.waitFor(() => expect(list.posts.value).toHaveLength(30))
  expect(vi.mocked(fetchPostPage).mock.calls.map((call) => call[1]?.page)).toEqual([1, 1, 2])
})
