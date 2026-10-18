/** @file adminSessions.test.ts @description 会话分页、撤销确认、未知结果与当前会话退出顺序的组合函数回归。 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useAdminSessions } from '../../app/composables/useAdminSessions'
import type { AdminSessionItem } from '../../app/features/auth/sessionTypes'

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  clearSession: vi.fn(),
  success: vi.fn(),
  navigate: vi.fn(),
}))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useCurrentUser', () => () => ({ clearSession: mocks.clearSession }))
mockNuxtImport('useToast', () => () => ({ success: mocks.success }))
mockNuxtImport('navigateTo', () => mocks.navigate)

const item = (id = 'session-one', current = false): AdminSessionItem => ({
  id,
  device: 'Safari · macOS',
  createdAt: '2026-10-01T10:00:00Z',
  lastRefreshedAt: '2026-10-18T10:00:00Z',
  expiresAt: '2026-11-01T10:00:00Z',
  current,
})
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => (resolve = done))
  return { promise, resolve }
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
  mocks.clearSession.mockResolvedValue(undefined)
  mocks.navigate.mockResolvedValue(undefined)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('分页读取完成前锁住重复读取与撤销，确认后才更新页码和列表', async () => {
  const sessions = useAdminSessions()
  const request = deferred<{ items: AdminSessionItem[]; total: number }>()
  mocks.api.mockReturnValue(request.promise)
  const loading = sessions.load(3)
  expect(sessions.pending.value).toBe(true)
  expect(sessions.page.value).toBe(1)
  await sessions.load(4)
  await sessions.revoke(item())
  await sessions.revokeOthers()
  expect(mocks.api).toHaveBeenCalledExactlyOnceWith('/auth/sessions', { query: { page: 3 } })
  expect(window.confirm).not.toHaveBeenCalled()
  request.resolve({ items: [item()], total: 41 })
  await loading
  expect(sessions.items.value).toEqual([item()])
  expect(sessions.total.value).toBe(41)
  expect(sessions.page.value).toBe(3)
  expect(sessions.pending.value).toBe(false)
})

it('翻页失败保留已确认列表和页码，重试成功后清除错误', async () => {
  const sessions = useAdminSessions()
  mocks.api.mockResolvedValueOnce({ items: [item()], total: 21 }).mockRejectedValueOnce(new Error('断线'))
  await sessions.load(2)
  await sessions.load(3)
  expect(sessions.items.value).toEqual([item()])
  expect(sessions.page.value).toBe(2)
  expect(sessions.total.value).toBe(21)
  expect(sessions.error.value).toBe('会话列表读取失败，请重试')
  expect(sessions.pending.value).toBe(false)
  mocks.api.mockResolvedValueOnce({ items: [item('session-two')], total: 21 })
  await sessions.load()
  expect(mocks.api).toHaveBeenLastCalledWith('/auth/sessions', { query: { page: 2 } })
  expect(sessions.error.value).toBe('')
})

it.each([false, true])('取消撤销 current=%s 时不请求服务端、不改变列表', async (current) => {
  const sessions = useAdminSessions()
  sessions.items.value = [item('session-one', current)]
  vi.mocked(window.confirm).mockReturnValue(false)
  await sessions.revoke(sessions.items.value[0]!)
  expect(window.confirm).toHaveBeenCalledWith(
    current
      ? '撤销当前会话会立即退出并清空当前账号页输入，确定继续吗？'
      : '撤销“Safari · macOS”的会话？该会话之后的管理请求将被拒绝。',
  )
  expect(mocks.api).not.toHaveBeenCalled()
  expect(sessions.items.value).toEqual([item('session-one', current)])
  expect(mocks.clearSession).not.toHaveBeenCalled()
})

it('撤销其他会话等待服务端确认后提示并重新读取第一页', async () => {
  const sessions = useAdminSessions()
  const request = deferred<{ current: boolean }>()
  sessions.items.value = [item()]
  sessions.page.value = 3
  mocks.api.mockReturnValueOnce(request.promise).mockResolvedValueOnce({ items: [item('self', true)], total: 1 })
  const revoking = sessions.revoke(item())
  expect(mocks.api).toHaveBeenCalledWith('/auth/sessions/session-one', { method: 'DELETE' })
  expect(sessions.items.value).toEqual([item()])
  expect(mocks.success).not.toHaveBeenCalled()
  request.resolve({ current: false })
  await revoking
  expect(mocks.success).toHaveBeenCalledExactlyOnceWith('所选会话已撤销')
  expect(mocks.api).toHaveBeenLastCalledWith('/auth/sessions', { query: { page: 1 } })
  expect(sessions.items.value).toEqual([item('self', true)])
  expect(sessions.page.value).toBe(1)
  expect(mocks.clearSession).not.toHaveBeenCalled()
})

it('以服务端的当前会话结果为准，清除身份完成后才跳转登录', async () => {
  const sessions = useAdminSessions()
  const clearing = deferred<undefined>()
  mocks.api.mockResolvedValue({ current: true })
  mocks.clearSession.mockReturnValue(clearing.promise)
  const revoking = sessions.revoke(item())
  await vi.waitFor(() => expect(mocks.clearSession).toHaveBeenCalledOnce())
  expect(mocks.navigate).not.toHaveBeenCalled()
  expect(sessions.pending.value).toBe(true)
  clearing.resolve(undefined)
  await revoking
  expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith('/admin/login')
  expect(mocks.api).toHaveBeenCalledOnce()
  expect(mocks.success).not.toHaveBeenCalled()
  expect(sessions.pending.value).toBe(false)
})

it('撤销响应丢失保留列表，不宣称成功、退出或自动刷新', async () => {
  const sessions = useAdminSessions()
  sessions.items.value = [item('self', true)]
  mocks.api.mockRejectedValue(new Error('响应丢失'))
  await sessions.revoke(item('self', true))
  expect(sessions.items.value).toEqual([item('self', true)])
  expect(sessions.error.value).toBe('未能确认撤销结果，请刷新会话列表后检查')
  expect(sessions.pending.value).toBe(false)
  expect(mocks.api).toHaveBeenCalledOnce()
  expect(mocks.clearSession).not.toHaveBeenCalled()
  expect(mocks.success).not.toHaveBeenCalled()
})

it('只有一个会话或取消确认时不撤销其他会话，确认后使用服务端实际数量', async () => {
  const sessions = useAdminSessions()
  sessions.total.value = 1
  await sessions.revokeOthers()
  expect(window.confirm).not.toHaveBeenCalled()
  sessions.total.value = 5
  vi.mocked(window.confirm).mockReturnValueOnce(false)
  await sessions.revokeOthers()
  expect(mocks.api).not.toHaveBeenCalled()
  mocks.api.mockResolvedValueOnce({ revoked: 3 }).mockResolvedValueOnce({ items: [item('self', true)], total: 1 })
  await sessions.revokeOthers()
  expect(mocks.api).toHaveBeenNthCalledWith(1, '/auth/sessions/revoke-others', { method: 'POST' })
  expect(mocks.success).toHaveBeenCalledExactlyOnceWith('已撤销 3 个其他会话')
  expect(sessions.total.value).toBe(1)
  expect(mocks.clearSession).not.toHaveBeenCalled()
})

it('撤销其他会话失败保留原总数并提示核对结果', async () => {
  const sessions = useAdminSessions()
  sessions.total.value = 4
  mocks.api.mockRejectedValue(new Error('断线'))
  await sessions.revokeOthers()
  expect(sessions.total.value).toBe(4)
  expect(sessions.error.value).toBe('未能确认撤销结果，请刷新列表后检查')
  expect(sessions.pending.value).toBe(false)
  expect(mocks.api).toHaveBeenCalledOnce()
  expect(mocks.success).not.toHaveBeenCalled()
})
