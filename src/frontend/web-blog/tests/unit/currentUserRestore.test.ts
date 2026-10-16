/** @file currentUserRestore.test.ts @description 会话恢复重试：确认匿名后清除临时错误，401与刷新失败仍准确保留 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useCurrentUser } from '../../app/composables/useCurrentUser'
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))
mockNuxtImport('$fetch', () => mocks.fetch)
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  mocks.fetch.mockReset()
  localStorage.removeItem('blog-auth-cookie-pending')
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.unstubAllGlobals()
})
async function setup() {
  let auth!: ReturnType<typeof useCurrentUser>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          auth = useCurrentUser()
          auth.currentUser.value = null
          auth.accessToken.value = null
          auth.initialized.value = false
          auth.authError.value = ''
          auth.restoringPending.value = false
          return () => h('div')
        },
      }),
    ),
  )
  vi.stubGlobal('$fetch', mocks.fetch)
  return auth
}
it('首次会话请求503后重试确认匿名，清除临时错误且不创建用户或令牌', async () => {
  const auth = await setup()
  mocks.fetch.mockRejectedValueOnce(Object.assign(new Error('service unavailable'), { statusCode: 503 }))
  expect(await auth.restore()).toBe(false)
  expect(auth.initialized.value).toBe(false)
  expect(auth.authError.value).toBe('登录状态暂时无法确认，请重试')
  mocks.fetch.mockResolvedValueOnce({ data: { authenticated: false } })
  expect(await auth.restore()).toBe(false)
  expect(auth.initialized.value).toBe(true)
  expect(auth.authError.value).toBe('')
  expect(auth.currentUser.value).toBeNull()
  expect(auth.accessToken.value).toBeNull()
  expect(auth.isLoggedIn.value).toBe(false)
  expect(auth.restoringPending.value).toBe(false)
  expect(mocks.fetch.mock.calls.map(([path]) => path)).toEqual(['/api/v1/auth/session', '/api/v1/auth/session'])
  expect(await auth.restore()).toBe(false)
  expect(mocks.fetch).toHaveBeenCalledTimes(2)
})
it('会话存在但令牌刷新401时继续显示已过期，不伪装为无错误匿名', async () => {
  const auth = await setup()
  mocks.fetch
    .mockResolvedValueOnce({ data: { authenticated: true } })
    .mockRejectedValueOnce(Object.assign(new Error('expired'), { statusCode: 401 }))
  expect(await auth.restore()).toBe(false)
  expect(auth.initialized.value).toBe(true)
  expect(auth.authError.value).toBe('登录已过期，请重新登录')
  expect(auth.currentUser.value).toBeNull()
  expect(auth.accessToken.value).toBeNull()
  expect(mocks.fetch.mock.calls.map(([path]) => path)).toEqual(['/api/v1/auth/session', '/api/v1/auth/refresh'])
  await auth.restore()
  expect(auth.authError.value).toBe('登录已过期，请重新登录')
  expect(mocks.fetch).toHaveBeenCalledTimes(2)
})
it('刷新503保持可重试错误，只有随后会话明确确认匿名才清除', async () => {
  const auth = await setup()
  mocks.fetch
    .mockResolvedValueOnce({ data: { authenticated: true } })
    .mockRejectedValueOnce(Object.assign(new Error('unavailable'), { statusCode: 503 }))
  expect(await auth.restore()).toBe(false)
  expect(auth.initialized.value).toBe(false)
  expect(auth.authError.value).toBe('登录状态暂时无法确认，请重试')
  mocks.fetch.mockResolvedValueOnce({ data: { authenticated: false } })
  expect(await auth.restore()).toBe(false)
  expect(auth.initialized.value).toBe(true)
  expect(auth.authError.value).toBe('')
  expect(auth.currentUser.value).toBeNull()
  expect(auth.accessToken.value).toBeNull()
})
