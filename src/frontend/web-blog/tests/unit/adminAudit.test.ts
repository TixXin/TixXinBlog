/** @file adminAudit.test.ts @description 审计页按服务端标签区分批量与单条操作，并使用对应动作键筛选。 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import AuditPage from '../../app/pages/admin/audit.vue'
import type { AuditItem } from '../../app/features/audit/types'

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  push: vi.fn(),
  // 测试应用启动时 i18n 插件即读取路由，初值需带 query
  route: { path: '/', fullPath: '/', query: {} } as { path: string; fullPath: string; query: Record<string, string> },
}))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useCurrentUser', () => () => ({ restore: async () => true }))
mockNuxtImport('useRoute', () => () => mocks.route)
mockNuxtImport('useRouter', () => () => ({
  resolve: ({ path, query }: { path: string; query: Record<string, string> }) => ({
    fullPath: `${path}?${new URLSearchParams(query)}`,
  }),
  push: mocks.push,
  replace: vi.fn(),
  beforeEach: () => () => undefined,
  beforeResolve: () => () => undefined,
  afterEach: () => () => undefined,
  onError: () => () => undefined,
}))

const batchActions = [
  ['comment.batch.moderate', '批量审核评论'],
  ['comment.batch.delete', '批量删除评论'],
  ['guestbook.batch.moderate', '批量审核留言'],
  ['guestbook.batch.delete', '批量删除留言'],
] as const
const singleActions = [
  ['comment.moderate', '审核评论'],
  ['comment.delete', '删除评论及回复'],
  ['guestbook.update', '审核或置顶留言'],
  ['guestbook.delete', '删除留言'],
] as const
const actions = Object.fromEntries([...batchActions, ...singleActions])
const items: AuditItem[] = Object.entries(actions).map(([action, actionLabel], index) => ({
  id: `audit-${index}`,
  actor: '博主',
  action,
  actionLabel,
  resourceType: action.split('.')[0]!,
  state: 'success',
  summary: { fields: [] },
  createdAt: '2026-10-18T00:00:00.000Z',
}))
const wrappers: { unmount(): void }[] = []

beforeEach(() => {
  mocks.route = reactive({ path: '/admin/audit', fullPath: '/admin/audit', query: {} })
  mocks.push.mockReset()
  mocks.api.mockReset().mockImplementation(async (path: string) => {
    if (path === '/admin/audit/actions') return actions
    if (path === '/admin/audit')
      return { items, total: items.length, health: { waitingResults: 0, retryQueue: 0, droppedRetries: 0 } }
    throw new Error(path)
  })
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})

it('列表和筛选选项同时展示四种批量标签与原有单条标签', async () => {
  const page = await mountSuspended(AuditPage)
  wrappers.push(page)
  await flushPromises()

  expect(mocks.api).toHaveBeenCalledWith('/admin/audit/actions')
  expect(page.findAll('.audit-log h2').map((heading) => heading.text())).toEqual(Object.values(actions))
  expect(
    page
      .get('select')
      .findAll('option')
      .map((option) => [option.attributes('value'), option.text()]),
  ).toEqual([['', '全部操作'], ...Object.entries(actions)])
})

it.each(batchActions)('选择 %s 时保留批量动作键作为筛选条件', async (action) => {
  const page = await mountSuspended(AuditPage)
  wrappers.push(page)
  await flushPromises()

  await page.get('select').setValue(action)
  await page.get('form').trigger('submit')

  expect(mocks.push).toHaveBeenCalledWith({ path: '/admin/audit', query: { action } })
})
