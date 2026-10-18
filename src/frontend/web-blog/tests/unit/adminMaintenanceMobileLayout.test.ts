/** @file adminMaintenanceMobileLayout.test.ts @description 维护与账号页面移动布局容器保留原生控件、分页语义及操作。 */
import { afterEach, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import MaintenancePage from '../../app/pages/admin/maintenance.vue'
import AccountPage from '../../app/pages/admin/account.vue'
import OperationsPage from '../../app/pages/admin/operations.vue'
import ActiveSessions from '../../app/components/admin/ActiveSessions.vue'

const mocks = vi.hoisted(() => ({ api: vi.fn(), loadDiagnostics: vi.fn(), checkMedia: vi.fn() }))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useCurrentUser', () => () => ({
  currentUser: ref({ id: 'layout-owner' }),
  isLoggedIn: ref(true),
  restore: async () => true,
}))
mockNuxtImport('useAdminSessions', () => () => ({
  items: ref([]),
  total: ref(0),
  page: ref(1),
  pending: ref(false),
  error: ref(''),
  load: vi.fn(),
  revoke: vi.fn(),
  revokeOthers: vi.fn(),
}))
mockNuxtImport('useMaintenanceDiagnostics', () => () => ({
  pending: ref(false),
  error: ref(''),
  data: ref(null),
  media: ref(null),
  load: mocks.loadDiagnostics,
  checkMedia: mocks.checkMedia,
}))
mockNuxtImport('useContentBackup', () => () => ({
  pending: ref(false),
  error: ref(''),
  mediaIncluded: ref(true),
  file: ref(null),
  strategy: ref('skip'),
  includeSettings: ref(false),
  requestId: ref(''),
  job: ref(null),
  acknowledgement: ref(''),
  recent: ref([]),
  recentError: ref(''),
  exportPackage: vi.fn(),
  choose: vi.fn(),
  preview: vi.fn(),
  read: vi.fn(),
  repreview: vi.fn(),
  execute: vi.fn(),
  loadRecent: vi.fn(),
}))

const wrappers: { unmount(): void }[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.clearAllMocks()
})

it('维护页诊断按钮位于换行操作区，文件和导入策略保留带标签的收缩字段', async () => {
  const wrapper = await mountSuspended(MaintenancePage)
  wrappers.push(wrapper)
  const actions = wrapper.get('.maintenance__actions')
  expect(actions.findAll('button').map((button) => button.text())).toEqual(['刷新运行诊断', '核验现有媒体文件'])
  await actions.findAll('button')[0]!.trigger('click')
  await actions.findAll('button')[1]!.trigger('click')
  expect(mocks.loadDiagnostics).toHaveBeenCalledOnce()
  expect(mocks.checkMedia).toHaveBeenCalledOnce()
  expect(wrapper.get('label.maintenance__field input[type="file"]').attributes('accept')).toBe('application/json,.json')
  expect(wrapper.get('label.maintenance__field select').findAll('option')).toHaveLength(2)
  expect(wrapper.findAll('pre code')).toHaveLength(2)
  expect(wrapper.get('section[aria-label="选择内容包"] .maintenance__actions button').text()).toBe('生成导入预览')
})

it('账号表单保留密码标签、原生 fieldset 和自动填充语义', async () => {
  mocks.api.mockResolvedValue({ username: 'owner'.repeat(40) })
  const wrapper = await mountSuspended(AccountPage)
  wrappers.push(wrapper)
  await flushPromises()
  const form = wrapper.get('form.account__password')
  expect(form.get('fieldset').attributes('disabled')).toBeUndefined()
  expect(form.findAll('label input[type="password"]')).toHaveLength(3)
  expect(form.get('input[autocomplete="current-password"]').exists()).toBe(true)
  expect(form.findAll('input[autocomplete="new-password"]')).toHaveLength(2)
})

it('会话列表分页在独立换行导航内，保留页码和翻页事件', async () => {
  const wrapper = mount(ActiveSessions, {
    props: { items: [], total: 100, page: 2, pending: false, error: '', disabled: false },
  })
  wrappers.push(wrapper)
  expect(
    wrapper
      .get('.active-sessions__toolbar')
      .findAll('button')
      .map((button) => button.text()),
  ).toEqual(['刷新会话', '撤销其他全部会话'])
  const pagination = wrapper.get('nav.active-sessions__pagination[aria-label="会话分页"]')
  expect(pagination.get('span').text()).toContain('2 / 5')
  await pagination.findAll('button')[0]!.trigger('click')
  await pagination.findAll('button')[1]!.trigger('click')
  expect(wrapper.emitted('load')).toEqual([[1], [3]])
})

it('运行状态工具栏和任务分页独立换行，保留任务卡片与可读状态', async () => {
  mocks.api.mockResolvedValue({
    databaseAvailable: true,
    configured: { email: { enabled: false }, backup: { enabled: false } },
    runtime: { tasks: [], total: 40, failures: 0, lastVerifiedBackup: null, lastRecovery: null },
    storage: null,
    backupOverdue: false,
  })
  const wrapper = await mountSuspended(OperationsPage)
  wrappers.push(wrapper)
  await flushPromises()
  expect(wrapper.get('nav.operations__toolbar').attributes('aria-label')).toBe('运行状态操作')
  expect(wrapper.get('.operations__toolbar button').text()).toBe('刷新状态')
  expect(wrapper.get('nav.operations__pagination').attributes('aria-label')).toBe('任务分页')
  expect(wrapper.get('.operations__pagination').text()).toContain('1 / 2')
  expect(wrapper.text()).toContain('还没有任务记录')
})
