/** @file projectFocus.test.ts @description 稳定项目深链不丢失列表查询，缺失和迟到响应不破坏当前页面。 */
import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import type { Router } from 'vue-router'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useProjectFocus } from '../../app/composables/useProjectFocus'
const mocks = vi.hoisted(() => ({ detail: vi.fn() }))
mockNuxtImport('useProjectRepository', () => () => ({ detail: mocks.detail }))
let wrapper: { unmount(): void } | undefined
let router: Router
afterEach(() => {
  wrapper?.unmount()
  vi.clearAllMocks()
})
async function setup() {
  let state!: ReturnType<typeof useProjectFocus>
  wrapper = await mountSuspended(
    defineComponent({
      setup() {
        router = useRouter()
        state = useProjectFocus()
        return () => h('div')
      },
    }),
    { route: '/projects?project=42&q=关键词&page=2' },
  )
  await flushPromises()
  return state
}
it('编号读取与列表筛选独立，关闭详情保留分页与关键词', async () => {
  mocks.detail.mockResolvedValue({ id: 42, title: '项目' })
  const state = await setup()
  expect(mocks.detail).toHaveBeenCalledWith(42, expect.any(AbortSignal))
  expect(state.item.value?.id).toBe(42)
  await state.close()
  expect(router.currentRoute.value.query).toEqual({ q: '关键词', page: '2' })
})
it('缺失或撤回只给出详情反馈，快切编号取消旧请求', async () => {
  let finish!: (value: unknown) => void
  mocks.detail.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const state = await setup()
  mocks.detail.mockRejectedValueOnce(new Error('项目不存在或尚未公开'))
  await router.replace('/projects?project=99&q=关键词&page=2')
  await flushPromises()
  expect(mocks.detail.mock.calls[0]![1].aborted).toBe(true)
  expect(state.error.value).toBe('项目不存在或尚未公开')
  finish({ id: 42 })
  await flushPromises()
  expect(state.item.value).toBeNull()
  expect(state.target.value).toBe('99')
})
