/** @file adminReadResource.test.ts @description 共用管理读取的请求竞态、失败保留、身份切换与写入反馈归属 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, reactive } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useAdminReadResource } from '../../app/composables/useAdminReadResource'
const mocks = vi.hoisted(() => ({
  auth: {} as { currentUser: Ref<{ id: string } | null>; restore: ReturnType<typeof vi.fn> },
  route: {} as { fullPath: string },
  navigate: vi.fn(),
}))
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
mockNuxtImport('useRoute', () => () => mocks.route)
mockNuxtImport('navigateTo', () => mocks.navigate)
const wrappers: { unmount(): void }[] = []
const deferred = <T>() => {
  let resolve!: (value: T) => void, reject!: (cause: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth = { currentUser: ref({ id: 'owner-a' }), restore: vi.fn().mockResolvedValue(true) }
  mocks.route = reactive({ fullPath: '/admin/notifications?filter=all' })
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
async function setup(read: () => Promise<{ value: string }>) {
  let resource!: ReturnType<typeof useAdminReadResource<{ value: string }>>, context!: Ref<string>
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        context = useState<string>('page-content-context', () => '')
        context.value = 'library-a'
        resource = useAdminReadResource(read, '读取失败')
        return () => h('div')
      },
    }),
  )
  wrappers.push(wrapper)
  await flushPromises()
  return { resource, context, wrapper }
}
it('迟到失败不覆盖较新成功或清除当前请求状态', async () => {
  const first = deferred<{ value: string }>(),
    second = deferred<{ value: string }>()
  const read = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  const { resource } = await setup(read)
  const loading = resource.refresh()
  first.reject(new Error('旧失败'))
  await flushPromises()
  expect(resource.pending.value).toBe(true)
  expect(resource.error.value).toBe('')
  second.resolve({ value: '最新' })
  await loading
  expect(resource.data.value).toEqual({ value: '最新' })
  expect(resource.pending.value).toBe(false)
})
it('普通刷新失败保留上次数据，重试能替换状态', async () => {
  const read = vi
    .fn()
    .mockResolvedValueOnce({ value: '上次' })
    .mockRejectedValueOnce(new Error('故障'))
    .mockResolvedValueOnce({ value: '恢复' })
  const { resource } = await setup(read)
  await resource.refresh()
  expect(resource.data.value).toEqual({ value: '上次' })
  expect(resource.error.value).toBe('读取失败')
  await resource.refresh()
  expect(resource.data.value).toEqual({ value: '恢复' })
  expect(resource.error.value).toBe('')
})
it.each(['actor', 'context'])('%s 切换立即清除旧数据且迟到结果不能回填', async (kind) => {
  const old = deferred<{ value: string }>(),
    latest = deferred<{ value: string }>()
  const read = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise)
  const { resource, context } = await setup(read)
  const guard = resource.captureOwnership()
  if (kind === 'actor') mocks.auth.currentUser.value = { id: 'owner-b' }
  else context.value = 'library-b'
  expect(resource.data.value).toBeNull()
  expect(guard()).toBe(false)
  old.resolve({ value: '旧资料' })
  await flushPromises()
  expect(resource.data.value).toBeNull()
  latest.resolve({ value: '当前资料' })
  await flushPromises()
  expect(resource.data.value).toEqual({ value: '当前资料' })
})
it('写入反馈绑定路由，卸载后旧读取及反馈均失效', async () => {
  const value = deferred<{ value: string }>()
  const { resource, wrapper } = await setup(() => value.promise)
  const guard = resource.captureOwnership()
  mocks.route.fullPath = '/admin/notifications?filter=unread'
  expect(guard()).toBe(false)
  const nextGuard = resource.captureOwnership()
  wrapper.unmount()
  expect(nextGuard()).toBe(false)
  value.resolve({ value: '已卸载' })
  await flushPromises()
  expect(resource.data.value).toBeNull()
})
