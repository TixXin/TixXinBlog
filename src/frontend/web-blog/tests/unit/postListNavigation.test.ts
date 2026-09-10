/** @file postListNavigation.test.ts @description 实际列表组合函数的离开锁、旧触底取消和 Nuxt 路由延迟回归 */
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { createMemoryHistory, createRouter, type NavigationFailure } from 'vue-router'
import { usePostListRoute } from '../../app/composables/usePostListRoute'
import { usePostListPagination } from '../../app/composables/usePostListPagination'

type Location = { path: string; fullPath: string }
type After = (to: Location, from: Location, failure?: NavigationFailure) => void
const mocks = vi.hoisted(() => ({
  enabled: false,
  route: {} as { path: string; query: Record<string, string> },
  router: {} as {
    currentRoute: { value: Location }
    afterEach: (callback: After) => () => void
    replace: ReturnType<typeof vi.fn>
    push: ReturnType<typeof vi.fn>
  },
  leave: [] as ((to: Location) => void)[],
  after: [] as After[],
}))
mockNuxtImport('useRoute', async () => {
  const actual = await vi.importActual<typeof import('#app/composables/router')>('#app/composables/router')
  return () => (mocks.enabled ? mocks.route : actual.useRoute())
})
mockNuxtImport('useRouter', async () => {
  const actual = await vi.importActual<typeof import('#app/composables/router')>('#app/composables/router')
  return () => (mocks.enabled ? mocks.router : actual.useRouter())
})
mockNuxtImport('onBeforeRouteLeave', () => (callback: (to: Location) => void) => mocks.leave.push(callback))
let aborted!: NavigationFailure, cancelled!: NavigationFailure
const wrappers: { unmount(): void }[] = []
beforeAll(async () => {
  // 使用 Vue Router 真正产生的失败对象，避免伪造 type 值绕过 isNavigationFailure。
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }],
  })
  await router.push('/')
  let finish!: () => void
  router.beforeEach((to) => {
    if (to.path === '/refused') return false
    if (to.path === '/slow') return new Promise<void>((resolve) => (finish = resolve))
  })
  aborted = (await router.push('/refused')) as NavigationFailure
  const older = router.push('/slow')
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  await router.push('/newer')
  finish()
  cancelled = (await older) as NavigationFailure
})
beforeEach(() => {
  mocks.enabled = true
  mocks.leave.length = 0
  mocks.after.length = 0
  mocks.route = reactive({ path: '/', query: { page: '2', mode: 'continuous' } })
  mocks.router = {
    currentRoute: ref({ path: '/', fullPath: '/?page=2&mode=continuous' }),
    afterEach: (callback) => {
      mocks.after.push(callback)
      return () => {}
    },
    replace: vi.fn().mockResolvedValue(undefined),
    push: vi.fn().mockResolvedValue(undefined),
  }
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  mocks.enabled = false
})
async function setup() {
  let state!: ReturnType<typeof usePostListRoute>
  let pagination!: ReturnType<typeof usePostListPagination>
  const requested = vi.fn()
  wrappers.push(
    mount(
      defineComponent({
        setup() {
          state = usePostListRoute()
          pagination = usePostListPagination({
            posts: ref([]),
            total: ref(106),
            currentPage: state.page,
            pending: ref(false),
            error: ref(''),
            displayMode: state.displayMode,
            scrollbarRef: ref(null),
            requestPage: requested,
          })
          return () => h('div')
        },
      }),
    ),
  )
  await nextTick()
  await flushPromises()
  return { state, pagination, requested }
}
const list = { path: '/', fullPath: '/?page=2&mode=continuous' }
const nextPage = { path: '/', fullPath: '/?page=3&mode=continuous' }
const article = { path: '/articles/77', fullPath: '/articles/77' }

it('离开途中旧同页触底请求被取消，不能解锁并再次请求下一页', async () => {
  const { state, pagination, requested } = await setup()
  mocks.leave.forEach((callback) => callback(article))
  mocks.after.forEach((callback) => callback(nextPage, list, cancelled))
  state.page.value = 3
  pagination.goToPage(3)
  expect(mocks.router.replace).not.toHaveBeenCalled()
  expect(requested).not.toHaveBeenCalled()
})
it('真正拒绝本次离开后可继续触底与修改页码', async () => {
  const { state, pagination, requested } = await setup()
  mocks.leave.forEach((callback) => callback(article))
  mocks.after.forEach((callback) => callback(article, list, aborted))
  pagination.goToPage(3)
  state.page.value = 3
  expect(requested).toHaveBeenCalledWith(3)
  expect(mocks.router.replace).toHaveBeenCalledWith({ path: '/', query: { page: '3', mode: 'continuous' } })
})
it('另一旧导航被拒绝时不能解开当前离开目标，成功返回本页后才恢复', async () => {
  const { state, pagination, requested } = await setup()
  mocks.leave.forEach((callback) => callback(article))
  mocks.after.forEach((callback) => callback({ path: '/articles/66', fullPath: '/articles/66' }, list, aborted))
  state.page.value = 3
  pagination.goToPage(3)
  expect(requested).not.toHaveBeenCalled()
  expect(mocks.router.replace).not.toHaveBeenCalled()
  mocks.after.forEach((callback) => callback(list, article))
  state.page.value = 3
  pagination.goToPage(3)
  expect(requested).toHaveBeenCalledWith(3)
  expect(mocks.router.replace).toHaveBeenCalledOnce()
})
it('即时路由已到详情而 Nuxt route 仍是列表时，不能写回列表 URL', async () => {
  const { state, pagination, requested } = await setup()
  mocks.router.currentRoute.value = article
  expect(mocks.route.path).toBe('/')
  state.page.value = 3
  pagination.goToPage(3)
  expect(mocks.router.replace).not.toHaveBeenCalled()
  expect(requested).not.toHaveBeenCalled()
})
