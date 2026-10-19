/** @file adminNotificationsReadAll.test.ts @description 通知全部已读：调用批量已读接口、刷新列表、同步导航未读徽章；失败给出可见提示且不改变徽章 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import NotificationsPage from '../../app/pages/admin/notifications.vue'
import Navigation from '../../app/components/admin/Navigation.vue'

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  auth: {} as {
    currentUser: Ref<{ id: string } | null>
    isLoggedIn: Ref<boolean>
    restore: ReturnType<typeof vi.fn>
  },
  // 初始 query 供 i18n 插件在测试应用启动时读取路由，缺失会导致界面语言未安装
  route: { query: {} } as { path: string; fullPath: string; query: Record<string, string> },
}))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useToast', () => () => mocks.toast)
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
mockNuxtImport('useRoute', () => () => mocks.route)

const wrappers: { unmount(): void }[] = []
let unread = 3
const item = (id: string, readAt: string | null) => ({
  id,
  kind: 'comment',
  reason: 'pending_review',
  state: 'pending_review',
  url: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  readAt,
})
beforeEach(() => {
  unread = 3
  Object.values(mocks.toast).forEach((mock) => mock.mockReset())
  mocks.auth = { currentUser: ref({ id: 'owner' }), isLoggedIn: ref(true), restore: vi.fn().mockResolvedValue(true) }
  mocks.route = reactive({ path: '/admin/notifications', fullPath: '/admin/notifications', query: {} })
  mocks.api.mockReset().mockImplementation(async (path: string) => {
    if (path === '/admin/notifications/summary') return { unread }
    if (path === '/admin/notifications')
      return {
        page: 1,
        pageSize: 20,
        total: 3,
        unread,
        items: [item('a', unread ? null : 'x'), item('b', unread ? null : 'x'), item('c', 'x')],
      }
    if (path === '/admin/notifications/read-all') {
      const updated = unread
      unread = 0
      return { updated, unread: 0 }
    }
    throw new Error(path)
  })
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  useState('admin-notification-unread').value = null
})

it('全部标记已读后刷新列表与导航徽章，并在状态区播报结果', async () => {
  const nav = await mountSuspended(Navigation)
  const page = await mountSuspended(NotificationsPage, { attachTo: document.body })
  wrappers.push(nav, page)
  await flushPromises()
  expect(nav.get('.admin-navigation__badge').text()).toContain('3 条未读')
  const button = page.findAll('button').find((candidate) => candidate.text() === '全部标记已读')!
  await button.trigger('click')
  await flushPromises()
  expect(mocks.api).toHaveBeenCalledWith('/admin/notifications/read-all', { method: 'POST', body: {} })
  expect(page.text()).toContain('未读 0 条')
  expect(page.findAll('button').some((candidate) => candidate.text() === '全部标记已读')).toBe(false)
  expect(page.get('.notifications__status').text()).toBe('已将 3 条通知标记为已读')
  expect(mocks.toast.success).toHaveBeenCalledWith('已将 3 条通知标记为已读')
  expect(nav.find('.admin-navigation__badge').exists()).toBe(false)
})

it('全部已读失败时显示可见错误，保留未读数量', async () => {
  const page = await mountSuspended(NotificationsPage, { attachTo: document.body })
  wrappers.push(page)
  await flushPromises()
  mocks.api.mockImplementation(async (path: string) => {
    if (path === '/admin/notifications/read-all') throw new Error('network')
    return { page: 1, pageSize: 20, total: 0, unread: 3, items: [] }
  })
  await page
    .findAll('button')
    .find((candidate) => candidate.text() === '全部标记已读')!
    .trigger('click')
  await flushPromises()
  expect(page.get('[role="alert"]').text()).toContain('全部已读未确认')
  expect(useState('admin-notification-unread').value).toBe(3)
})
