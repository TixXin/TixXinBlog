/** @file adminApiOwnership.test.ts @description 管理请求在认证刷新与内容恢复期间禁止跨账号或跨内容库重放 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { Ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useAdminApi } from '../../app/composables/useAdminApi'
const mocks = vi.hoisted(() => ({
  auth: {} as {
    currentUser: Ref<{ id: string } | null>
    accessToken: Ref<string | null>
    restore: ReturnType<typeof vi.fn>
    refresh: ReturnType<typeof vi.fn>
    clearSession: ReturnType<typeof vi.fn>
  },
  fetch: vi.fn(),
}))
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
mockNuxtImport('$fetch', () => mocks.fetch)
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  mocks.auth = {
    currentUser: ref({ id: 'actor-a' }),
    accessToken: ref('token-a'),
    restore: vi.fn().mockResolvedValue(true),
    refresh: vi.fn(),
    clearSession: vi.fn(),
  }
  mocks.fetch.mockReset()
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.unstubAllGlobals()
})
async function setup() {
  let api!: ReturnType<typeof useAdminApi>, context!: Ref<string>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          context = useState<string>('page-content-context', () => '')
          context.value = 'library-a'
          api = useAdminApi()
          return () => h('div')
        },
      }),
    ),
  )
  vi.stubGlobal('$fetch', mocks.fetch)
  return { api, context }
}
it('同一账号刷新令牌后可重试，使用发起时的正文和上下文', async () => {
  const { api } = await setup(),
    body = { revision: 2, title: '发起时的输入' }
  mocks.fetch.mockRejectedValueOnce({ statusCode: 401 }).mockResolvedValueOnce({ data: { ok: true } })
  mocks.auth.refresh.mockImplementation(async () => {
    body.title = '后来继续输入'
    mocks.auth.accessToken.value = 'token-a-new'
    return true
  })
  await expect(api('/admin/gallery/7', { method: 'PATCH', body })).resolves.toEqual({ ok: true })
  expect(mocks.fetch).toHaveBeenCalledTimes(2)
  expect(mocks.fetch.mock.calls[1]![1]).toMatchObject({
    body: { revision: 2, title: '发起时的输入' },
    headers: { Authorization: 'Bearer token-a-new', 'X-Content-Context': 'library-a' },
  })
})
it('401期间刷新到另一账号时拒绝发送原账号正文', async () => {
  const { api } = await setup()
  mocks.fetch.mockRejectedValueOnce({ statusCode: 401 })
  mocks.auth.refresh.mockImplementation(async () => {
    mocks.auth.currentUser.value = { id: 'actor-b' }
    mocks.auth.accessToken.value = 'token-b'
    return true
  })
  await expect(
    api('/admin/gallery/7', { method: 'PATCH', body: { revision: 2, title: 'A的输入' } }),
  ).rejects.toMatchObject({ statusCode: 409 })
  expect(mocks.fetch).toHaveBeenCalledTimes(1)
  expect(mocks.auth.clearSession).not.toHaveBeenCalled()
})
it('401期间内容库恢复即使账号不变也不能使用新上下文重放', async () => {
  const { api, context } = await setup()
  mocks.fetch.mockRejectedValueOnce({ statusCode: 401 })
  mocks.auth.refresh.mockImplementation(async () => {
    context.value = 'restored-library'
    return true
  })
  await expect(
    api('/admin/gallery/7', { method: 'PATCH', body: { revision: 2, title: '旧库输入' } }),
  ).rejects.toMatchObject({ statusCode: 409 })
  expect(mocks.fetch).toHaveBeenCalledTimes(1)
})
it('首个请求发出前身份恢复变化时直接拒绝发送', async () => {
  const { api } = await setup()
  mocks.auth.restore.mockImplementation(async () => {
    mocks.auth.currentUser.value = { id: 'actor-b' }
    return true
  })
  await expect(api('/admin/gallery/7', { method: 'DELETE', query: { revision: 2 } })).rejects.toMatchObject({
    statusCode: 409,
  })
  expect(mocks.fetch).not.toHaveBeenCalled()
})
