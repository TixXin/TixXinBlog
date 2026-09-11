/** @file adminFlashEntryReady.test.ts @description 闪念入口在挂载及身份恢复前不可开启，恢复过程不重建已经打开的编辑器 */
import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useAdminFlashes } from '../../app/composables/useAdminFlashes'

const mocks = vi.hoisted(() => ({
  auth: {} as { isLoggedIn: Ref<boolean>; restoringPending: Ref<boolean>; restore: ReturnType<typeof vi.fn> },
  api: vi.fn(),
}))
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useToast', () => () => ({ success: vi.fn() }))
mockNuxtImport('onBeforeRouteLeave', () => () => undefined)
mockNuxtImport('onBeforeRouteUpdate', () => () => undefined)
let wrapper: { unmount(): void } | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.clearAllMocks()
})

it('挂载和恢复门禁阻止新增，恢复完成允许打开且再次恢复不清空现有草稿', async () => {
  let release!: (value: boolean) => void
  mocks.auth = {
    isLoggedIn: ref(true),
    restoringPending: ref(false),
    restore: vi.fn(() => {
      mocks.auth.restoringPending.value = true
      return new Promise<boolean>((resolve) => {
        release = resolve
      })
    }),
  }
  mocks.api.mockResolvedValue({ items: [], total: 0 })
  let state!: ReturnType<typeof useAdminFlashes>,
    readyDuringSetup = true
  wrapper = await mountSuspended(
    defineComponent({
      setup() {
        state = useAdminFlashes()
        readyDuringSetup = state.editorReady.value
        return () => h('div')
      },
    }),
  )
  expect(readyDuringSetup).toBe(false)
  expect(state.editorReady.value).toBe(false)
  await state.openEditor()
  expect(state.editorOpen.value).toBe(false)
  expect(mocks.api).not.toHaveBeenCalled()
  mocks.auth.restoringPending.value = false
  release(true)
  await flushPromises()
  expect(state.editorReady.value).toBe(true)
  await state.openEditor()
  expect(state.editorOpen.value).toBe(true)
  state.dirty.value = true
  const key = state.editorKey.value
  mocks.auth.restoringPending.value = true
  expect(state.editorReady.value).toBe(false)
  await state.openEditor()
  expect(state.editorOpen.value).toBe(true)
  expect(state.editorKey.value).toBe(key)
  expect(state.dirty.value).toBe(true)
  mocks.auth.restoringPending.value = false
  mocks.auth.isLoggedIn.value = false
  expect(state.editorReady.value).toBe(false)
  expect(state.editorOpen.value).toBe(true)
  expect(state.editorKey.value).toBe(key)
})

it('工作台编辑深链读取指定闪念，筛选与页码从地址恢复', async () => {
  mocks.auth = { isLoggedIn: ref(true), restoringPending: ref(false), restore: vi.fn().mockResolvedValue(true) }
  mocks.api.mockImplementation((path: string) =>
    Promise.resolve(path === '/admin/flashes' ? { items: [], total: 40 } : { id: 'note-a', content: '继续写作' }),
  )
  let state!: ReturnType<typeof useAdminFlashes>
  wrapper = await mountSuspended(
    defineComponent({
      setup() {
        state = useAdminFlashes()
        return () => h('div')
      },
    }),
    { route: '/admin/flashes?edit=note-a&status=draft&search=写作&page=2' },
  )
  await flushPromises()
  expect(state.page.value).toBe(2)
  expect(state.status.value).toBe('draft')
  expect(state.search.value).toBe('写作')
  expect(mocks.api).toHaveBeenCalledWith('/admin/flashes', {
    query: { page: 2, pageSize: 20, status: 'draft', search: '写作' },
  })
  expect(mocks.api).toHaveBeenCalledWith('/admin/flashes/note-a')
  expect(state.editing.value?.id).toBe('note-a')
  expect(state.editorOpen.value).toBe(true)
})

it('工作台新建深链在身份就绪后打开空白编辑器', async () => {
  mocks.auth = { isLoggedIn: ref(true), restoringPending: ref(false), restore: vi.fn().mockResolvedValue(true) }
  mocks.api.mockResolvedValue({ items: [], total: 0 })
  let state!: ReturnType<typeof useAdminFlashes>
  wrapper = await mountSuspended(
    defineComponent({
      setup() {
        state = useAdminFlashes()
        return () => h('div')
      },
    }),
    { route: '/admin/flashes?create=true' },
  )
  await flushPromises()
  expect(state.editorOpen.value).toBe(true)
  expect(state.editing.value).toBeNull()
})
