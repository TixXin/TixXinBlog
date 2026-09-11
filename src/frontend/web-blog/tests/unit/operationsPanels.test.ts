/** @file operationsPanels.test.ts @description 维护摘要局部失败及任务真实结果呈现，不把抑制、恢复和接收混为发送成功。 */
import { afterEach, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import OperationsSummary from '../../app/components/admin/OperationsSummary.vue'
import OperationTask from '../../app/components/admin/OperationTask.vue'
import type { OperationTask as Task } from '../../app/features/notification/types'
const mocks = vi.hoisted(() => ({ api: vi.fn() }))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useCurrentUser', () => () => ({ currentUser: ref({ id: 'panel-owner' }), restore: async () => true }))
const wrappers: { unmount(): void }[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.clearAllMocks()
})
const task: Task = {
  id: 'a',
  kind: 'mail',
  state: 'succeeded',
  attempts: 1,
  maxAttempts: 3,
  createdAt: '2026-09-11T12:00:00Z',
  availableAt: '2026-09-11T12:00:00Z',
  startedAt: null,
  finishedAt: null,
  errorCode: null,
  outcome: {
    accepted: false,
    suppressed: true,
    integrityVerified: false,
    transferVerified: false,
    transferConfigured: false,
    recoveryVerified: false,
  },
}
it('抑制的提醒显示没有发送，恢复记录不会伪装成生成备份', () => {
  const suppressed = mount(OperationTask, { props: { task } })
  wrappers.push(suppressed)
  expect(suppressed.text()).toContain('没有发送邮件')
  expect(suppressed.text()).not.toContain('SMTP 服务已接受')
  const recovered = mount(OperationTask, {
    props: {
      task: { ...task, kind: 'backup', outcome: { ...task.outcome!, suppressed: false, recoveryVerified: true } },
    },
  })
  wrappers.push(recovered)
  expect(recovered.text()).toContain('恢复校验记录')
  expect(recovered.text()).not.toContain('备份完整性校验通过')
})
it('未知投递需要明确重试，暂停状态没有直接重试按钮', () => {
  const uncertain = mount(OperationTask, { props: { task: { ...task, state: 'uncertain', outcome: null } } })
  wrappers.push(uncertain)
  expect(uncertain.text()).toContain('无法确认远端是否已接受')
  expect(uncertain.find('button').text()).toBe('核对并重试')
  const paused = mount(OperationTask, { props: { task: { ...task, state: 'paused', outcome: null } } })
  wrappers.push(paused)
  expect(paused.find('button').exists()).toBe(false)
})
it('SMTP 已接受但记录异常时不声称远端接受状态未知', () => {
  const accepted = mount(OperationTask, {
    props: { task: { ...task, state: 'uncertain', outcome: { ...task.outcome!, suppressed: false, accepted: true } } },
  })
  wrappers.push(accepted)
  expect(accepted.text()).toContain('SMTP 已接受，但执行结果记录出现异常')
  expect(accepted.text()).not.toContain('无法确认远端是否已接受')
})
it('单独维护请求失败仍显示真实未读数，重试恢复无需清空另一分区', async () => {
  let failed = true
  mocks.api.mockImplementation(async (path: string) => {
    if (path.endsWith('/summary')) return { unread: 3 }
    if (failed) throw new Error('isolated')
    return {
      runtime: { failures: 0, lastVerifiedBackup: null, lastRecovery: null },
      backupOverdue: false,
      storage: { low: false },
    }
  })
  const wrapper = await mountSuspended(OperationsSummary)
  wrappers.push(wrapper)
  await flushPromises()
  expect(wrapper.text()).toContain('3 条未读')
  expect(wrapper.text()).toContain('维护运行记录暂不可用')
  expect(wrapper.text()).not.toContain('0 条未读')
  failed = false
  await wrapper.find('button').trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('3 条未读')
  expect(wrapper.text()).toContain('最近恢复演练：尚无运行记录')
  expect(wrapper.text()).not.toContain('维护运行记录暂不可用')
})
