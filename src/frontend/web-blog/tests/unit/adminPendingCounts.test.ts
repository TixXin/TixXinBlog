/**
 * @file adminPendingCounts.test.ts
 * @description 后台导航待审徽章：审核类入口显示待审数与读屏说明，零值不显示，读取失败保留上次结果，离开审核页立即重读
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import Navigation from '../../app/components/admin/Navigation.vue'

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  auth: {} as { currentUser: Ref<{ id: string } | null>; isLoggedIn: Ref<boolean>; restore: ReturnType<typeof vi.fn> },
  route: { query: {} } as { path: string; fullPath: string; query: Record<string, string> },
}))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
mockNuxtImport('useRoute', () => () => mocks.route)

const wrappers: { unmount(): void }[] = []
let pending: Record<string, number> | Error
beforeEach(() => {
  clearNuxtState([
    'admin-pending-counts',
    'admin-pending-counts-at',
    'admin-notification-unread',
    'admin-notification-unread-at',
  ])
  pending = {
    pendingComments: 2,
    pendingFlashComments: 0,
    pendingMomentComments: 120,
    pendingGuestbook: 1,
    pendingLinkApplications: 0,
  }
  mocks.auth = { currentUser: ref({ id: 'owner' }), isLoggedIn: ref(true), restore: vi.fn().mockResolvedValue(true) }
  mocks.route = reactive({ path: '/admin', fullPath: '/admin', query: {} })
  mocks.api.mockReset().mockImplementation(async (path: string) => {
    if (path === '/admin/notifications/summary') return { unread: 0 }
    if (path === '/admin/overview/pending') {
      if (pending instanceof Error) throw pending
      return pending
    }
    throw new Error(path)
  })
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

async function mountNavigation() {
  const wrapper = await mountSuspended(Navigation, { global: { stubs: { Icon: true } } })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}
const badgeOf = (wrapper: Awaited<ReturnType<typeof mountNavigation>>, path: string) =>
  wrapper.find(`a[href="${path}"] .admin-navigation__badge`)
const pendingCalls = () => mocks.api.mock.calls.filter(([path]) => path === '/admin/overview/pending').length

it('审核类入口显示待审数与读屏说明，零值不显示，超过 99 显示 99+', async () => {
  const wrapper = await mountNavigation()
  expect(badgeOf(wrapper, '/admin/comments').text()).toBe('2，2 条待处理')
  expect(badgeOf(wrapper, '/admin/guestbook').find('[aria-hidden="true"]').text()).toBe('1')
  expect(badgeOf(wrapper, '/admin/moment-comments').find('[aria-hidden="true"]').text()).toBe('99+')
  expect(badgeOf(wrapper, '/admin/flash-comments').exists()).toBe(false)
  expect(badgeOf(wrapper, '/admin/links').exists()).toBe(false)
  expect(badgeOf(wrapper, '/admin/notifications').exists()).toBe(false)
})

it('普通切页 60 秒内复用，离开审核页立即重读；读取失败保留上次结果', async () => {
  const wrapper = await mountNavigation()
  expect(pendingCalls()).toBe(1)
  mocks.route.path = '/admin/posts'
  await nextTick()
  await flushPromises()
  expect(pendingCalls()).toBe(1)
  mocks.route.path = '/admin/comments'
  await nextTick()
  await flushPromises()
  pending = new Error('网络失败')
  mocks.route.path = '/admin/posts'
  await nextTick()
  await flushPromises()
  expect(pendingCalls()).toBe(2)
  expect(badgeOf(wrapper, '/admin/comments').exists()).toBe(true)
})

it('退出登录时清空徽章，重新登录后立即读取', async () => {
  const wrapper = await mountNavigation()
  mocks.auth.isLoggedIn.value = false
  await nextTick()
  expect(badgeOf(wrapper, '/admin/comments').exists()).toBe(false)
  pending = {
    pendingComments: 5,
    pendingFlashComments: 0,
    pendingMomentComments: 0,
    pendingGuestbook: 0,
    pendingLinkApplications: 0,
  }
  mocks.auth.isLoggedIn.value = true
  await nextTick()
  await flushPromises()
  expect(badgeOf(wrapper, '/admin/comments').find('[aria-hidden="true"]').text()).toBe('5')
})
