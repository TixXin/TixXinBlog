/** @file postListHydration.test.ts @description 实际Nuxt生命周期中SSR文章查询冻结与挂载后原生历史接管，保留分页及连续前缀 */
import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h, onMounted } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { usePostList } from '../../app/composables/usePostList'
import { usePostListRoute } from '../../app/composables/usePostListRoute'
import { fetchPostPage } from '../../app/features/post/api'
import { mockPosts } from '../../app/features/post/mock'

vi.mock('../../app/features/post/api', () => ({ fetchPostPage: vi.fn() }))
// 叶子组件不在 RouterView 下；只省略守卫注册，离开锁另由 postListNavigation 回归覆盖。
mockNuxtImport('onBeforeRouteLeave', () => () => {})
const wrappers: { unmount(): void }[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.mocked(fetchPostPage).mockReset()
})

it.each([
  { mode: 'pagination' as const, page: 2, size: 15, tag: 'Nuxt', folder: '工程笔记' },
  { mode: 'waterfall' as const, page: 3, size: 45, tag: undefined, folder: undefined },
])('SSR $mode 第$page页首帧保留原集合，mounted才请求原生第一页', async (scenario) => {
  let app!: ReturnType<typeof useNuxtApp>
  let route!: ReturnType<typeof usePostListRoute>
  let list!: Awaited<ReturnType<typeof usePostList>>
  let priorHydrating = false,
    priorServerRendered: boolean | undefined,
    mounted = false
  let complete!: (page: Awaited<ReturnType<typeof fetchPostPage>>) => void
  const frames: {
    page: number
    tag: string | null
    folder: string | null
    mode: string
    total: number
    ids: number[]
  }[] = []
  const requests: { page?: number; tag?: string; folder?: string; mounted: boolean; hydrating: boolean }[] = []
  const pageItems = mockPosts.slice((scenario.page - 1) * 15, scenario.page * 15)
  const serverItems = scenario.mode === 'waterfall' ? mockPosts.slice(0, 45) : pageItems
  const expectedFirst = mockPosts.slice(0, 15)
  vi.mocked(fetchPostPage).mockImplementation((_base, query) => {
    requests.push({ page: query?.page, tag: query?.tag, folder: query?.folder, mounted, hydrating: app.isHydrating })
    return new Promise((resolve) => {
      complete = resolve
    })
  })
  try {
    const wrapper = await mountSuspended(
      defineComponent({
        async setup() {
          app = useNuxtApp()
          priorHydrating = app.isHydrating
          priorServerRendered = app.payload.serverRendered
          clearNuxtData('post-list')
          app.isHydrating = true
          app.payload.serverRendered = true
          app.payload.data['post-list'] = {
            items: pageItems,
            total: mockPosts.length,
            page: scenario.page,
            pageSize: 15,
            scopeKey: JSON.stringify({ tag: scenario.tag, folder: scenario.folder, mode: scenario.mode }),
            chunks:
              scenario.mode === 'waterfall'
                ? [1, 2, 3].map((page) => ({ page, items: mockPosts.slice((page - 1) * 15, page * 15) }))
                : [{ page: scenario.page, items: pageItems }],
          }
          onMounted(() => {
            mounted = true
          })
          route = usePostListRoute()
          list = await usePostList({ ...route, displayMode: route.displayMode, resetOnScopeChange: false })
          expect(fetchPostPage).not.toHaveBeenCalled()
          return () => {
            frames.push({
              page: route.page.value,
              tag: route.selectedTag.value,
              folder: route.selectedCategory.value,
              mode: route.displayMode.value,
              total: list.total.value,
              ids: list.posts.value.map((post) => post.id),
            })
            return h(
              'section',
              { 'data-page': route.page.value },
              list.posts.value.map((post) => h('article', { 'data-post-id': post.id }, post.title)),
            )
          }
        },
      }),
      { route: scenario.mode === 'waterfall' ? '/?page=1&mode=continuous' : '/?page=1' },
    )
    wrappers.push(wrapper)
    expect(frames[0]).toEqual({
      page: scenario.page,
      tag: scenario.tag ?? null,
      folder: scenario.folder ?? null,
      mode: scenario.mode,
      total: mockPosts.length,
      ids: serverItems.map((post) => post.id),
    })
    await vi.waitFor(() => expect(requests).toHaveLength(1))
    expect(requests).toEqual([{ page: 1, tag: undefined, folder: undefined, mounted: true, hydrating: true }])
    expect(list.pending.value).toBe(true)
    expect(list.posts.value.map((post) => post.id)).toEqual(serverItems.map((post) => post.id))
    expect(list.total.value).toBe(mockPosts.length)
    complete({ items: expectedFirst, total: mockPosts.length, page: 1, pageSize: 15 })
    await vi.waitFor(() =>
      expect(list.posts.value.map((post) => post.id)).toEqual(expectedFirst.map((post) => post.id)),
    )
    expect(route.page.value).toBe(1)
    expect(route.selectedTag.value).toBeNull()
    expect(route.selectedCategory.value).toBeNull()
    expect(wrapper.findAll('article').map((item) => Number(item.attributes('data-post-id')))).toEqual(
      expectedFirst.map((post) => post.id),
    )
    expect(app.payload.data['post-list'].page).toBe(1)
  } finally {
    if (app) {
      app.isHydrating = priorHydrating
      app.payload.serverRendered = priorServerRendered
    }
  }
})
