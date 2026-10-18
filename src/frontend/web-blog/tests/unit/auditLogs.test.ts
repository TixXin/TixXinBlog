/** @file auditLogs.test.ts @description 审计记录认证、URL 筛选分页、迟到响应隔离与局部失败恢复的组合函数回归。 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useAuditLogs } from '../../app/composables/useAuditLogs'
import type { AuditItem } from '../../app/features/audit/types'

type Query = Record<string, string | string[] | undefined>
type Location = { path: string; query: Record<string, string> }
const mocks = vi.hoisted(() => ({
  enabled: false,
  api: vi.fn(),
  restore: vi.fn(),
  navigate: vi.fn(),
  route: {} as { fullPath: string; query: Query },
  router: { resolve: vi.fn(), push: vi.fn() },
}))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useCurrentUser', () => () => ({ restore: mocks.restore }))
mockNuxtImport('useRoute', async () => {
  const actual = await vi.importActual<typeof import('#app/composables/router')>('#app/composables/router')
  return () => (mocks.enabled ? mocks.route : actual.useRoute())
})
mockNuxtImport('useRouter', async () => {
  const actual = await vi.importActual<typeof import('#app/composables/router')>('#app/composables/router')
  return () => (mocks.enabled ? mocks.router : actual.useRouter())
})
mockNuxtImport('navigateTo', () => mocks.navigate)

const wrappers: { unmount(): void }[] = []
const item = (id: string): AuditItem => ({
  id,
  actor: '博主',
  action: 'post.update',
  actionLabel: '更新文章',
  resourceType: 'post',
  resourceId: '8',
  state: 'success',
  summary: { fields: ['title'], submittedVersion: 2, currentVersion: 3 },
  createdAt: '2026-10-18T10:00:00Z',
})
const response = (id = 'latest', total = 1) => ({
  items: [item(id)],
  total,
  health: { waitingResults: 2, retryQueue: 1, droppedRetries: 0 },
})
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.enabled = true
  mocks.route = reactive({ fullPath: '/admin/audit', query: {} })
  mocks.restore.mockResolvedValue(true)
  mocks.navigate.mockResolvedValue(undefined)
  mocks.router.resolve.mockImplementation(({ path, query }: Location) => {
    const search = new URLSearchParams(query).toString()
    return { fullPath: `${path}${search ? `?${search}` : ''}` }
  })
  mocks.router.push.mockResolvedValue(undefined)
  mocks.api.mockImplementation(async (path: string) =>
    path === '/admin/audit/actions' ? { 'post.update': '更新文章' } : response(),
  )
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  mocks.enabled = false
})
async function setup() {
  let audit!: ReturnType<typeof useAuditLogs>
  const wrapper = mount(
    defineComponent({
      setup() {
        audit = useAuditLogs()
        return () => h('div')
      },
    }),
  )
  wrappers.push(wrapper)
  await flushPromises()
  return { audit, wrapper }
}

it('恢复认证后并行读取操作选项和 URL 筛选，保留真实总数与健康统计', async () => {
  mocks.route.query = { action: 'post.update', state: 'unknown', from: '2026-10-01', to: '2026-10-18', page: '2' }
  mocks.api.mockImplementation(async (path: string) =>
    path === '/admin/audit/actions' ? { 'post.update': '更新文章' } : response('filtered', 25),
  )
  const { audit } = await setup()
  expect(mocks.restore).toHaveBeenCalledOnce()
  expect(mocks.api).toHaveBeenCalledWith('/admin/audit', {
    query: { page: 2, action: 'post.update', state: 'unknown', from: '2026-10-01', to: '2026-10-18' },
  })
  expect(audit.items.value).toEqual([item('filtered')])
  expect(audit.total.value).toBe(25)
  expect(audit.actions.value).toEqual({ 'post.update': '更新文章' })
  expect(audit.health.value).toEqual({ waitingResults: 2, retryQueue: 1, droppedRetries: 0 })
  expect(audit.pending.value).toBe(false)
})

it.each(['0', '-1', '1.5', '10001', 'Infinity', ['2', '3']])('忽略非法页码 %j、数组筛选和未定义状态', async (page) => {
  mocks.route.query = { page, action: ['post.update'], state: '__proto__', from: ['2026-10-01'] }
  const { audit } = await setup()
  expect(audit.page.value).toBe(1)
  expect(audit.action.value).toBe('')
  expect(audit.state.value).toBe('')
  expect(audit.from.value).toBe('')
  expect(mocks.api).toHaveBeenCalledWith('/admin/audit', {
    query: { page: 1, action: undefined, state: undefined, from: undefined, to: undefined },
  })
})

it('身份恢复失败只跳转登录并保留返回地址，不请求管理数据', async () => {
  mocks.restore.mockResolvedValue(false)
  mocks.route.fullPath = '/admin/audit?state=failure'
  const { audit } = await setup()
  expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith({
    path: '/admin/login',
    query: { next: '/admin/audit?state=failure' },
  })
  expect(mocks.api).not.toHaveBeenCalled()
  expect(audit.pending.value).toBe(false)
})

it('筛选写入 URL，重复导航刷新当前查询，清空筛选返回不带页码的第一页', async () => {
  const { audit } = await setup()
  mocks.api.mockClear()
  await audit.navigate(1)
  expect(mocks.router.push).not.toHaveBeenCalled()
  expect(mocks.api).toHaveBeenCalledOnce()
  audit.action.value = 'post.update'
  audit.state.value = 'failure'
  audit.from.value = '2026-10-01'
  await audit.navigate(3)
  expect(mocks.router.push).toHaveBeenLastCalledWith({
    path: '/admin/audit',
    query: { action: 'post.update', state: 'failure', from: '2026-10-01', page: '3' },
  })
  mocks.route.fullPath = '/admin/audit?action=post.update&page=3'
  audit.clear()
  await flushPromises()
  expect([audit.action.value, audit.state.value, audit.from.value, audit.to.value]).toEqual(['', '', '', ''])
  expect(mocks.router.push).toHaveBeenLastCalledWith({ path: '/admin/audit', query: {} })
})

it('路由筛选改变后自动重读，越界分页使用当前总数导航到最后一页', async () => {
  const { audit } = await setup()
  mocks.api.mockClear().mockResolvedValue(response('new-filter', 21))
  mocks.route.query = { state: 'failure', page: '8' }
  mocks.route.fullPath = '/admin/audit?state=failure&page=8'
  await nextTick()
  await flushPromises()
  expect(mocks.api).toHaveBeenCalledExactlyOnceWith('/admin/audit', {
    query: { page: 8, action: undefined, state: 'failure', from: undefined, to: undefined },
  })
  expect(audit.items.value).toEqual([item('new-filter')])
  expect(mocks.router.push).toHaveBeenLastCalledWith({ path: '/admin/audit', query: { state: 'failure', page: '2' } })
})

it.each(['success', 'failure'])('旧请求迟到的 %s 不覆盖新查询且不提前解除忙碌状态', async (outcome) => {
  const { audit } = await setup()
  const older = deferred<ReturnType<typeof response>>()
  const newer = deferred<ReturnType<typeof response>>()
  mocks.api.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
  const first = audit.load()
  audit.state.value = 'failure'
  const second = audit.load()
  if (outcome === 'success') older.resolve(response('obsolete', 99))
  else older.reject(new Error('旧请求断线'))
  await first
  expect(audit.items.value).toEqual([item('latest')])
  expect(audit.total.value).toBe(1)
  expect(audit.error.value).toBe('')
  expect(audit.pending.value).toBe(true)
  newer.resolve(response('current', 5))
  await second
  expect(audit.items.value).toEqual([item('current')])
  expect(audit.total.value).toBe(5)
  expect(audit.pending.value).toBe(false)
})

it('最新读取失败保留筛选并清除不匹配的旧列表，选项失败可单独重试', async () => {
  const { audit } = await setup()
  audit.action.value = 'post.update'
  audit.state.value = 'unknown'
  mocks.api.mockRejectedValue(new Error('请求失败'))
  await Promise.all([audit.load(), audit.loadActions()])
  expect(audit.items.value).toEqual([])
  expect(audit.action.value).toBe('post.update')
  expect(audit.state.value).toBe('unknown')
  expect(audit.error.value).toBe('审计记录读取失败，请检查登录或筛选条件后重试')
  expect(audit.actionsError.value).toBe('操作筛选选项读取失败')
  expect(audit.actions.value).toEqual({ 'post.update': '更新文章' })
  expect(audit.pending.value).toBe(false)
  mocks.api.mockResolvedValue({ 'post.delete': '删除文章' })
  await audit.loadActions()
  expect(audit.actionsError.value).toBe('')
  expect(audit.actions.value).toEqual({ 'post.delete': '删除文章' })
  expect(audit.error.value).toContain('审计记录读取失败')
})

it('页面卸载后忽略仍在途的审计响应', async () => {
  const { audit, wrapper } = await setup()
  const request = deferred<ReturnType<typeof response>>()
  mocks.api.mockReturnValueOnce(request.promise)
  const loading = audit.load()
  wrapper.unmount()
  request.resolve(response('after-unmount', 200))
  await loading
  expect(audit.items.value).toEqual([item('latest')])
  expect(audit.total.value).toBe(1)
})
