/** @file mediaLibraryOwnership.test.ts @description 媒体工作区固定数据来源，换账号或恢复内容库不能选择旧图片、重放旧草稿或继续旧上传队列 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useMediaLibrary } from '../../app/composables/useMediaLibrary'
import type { MediaAsset } from '../../app/features/media/types'

const mocks = vi.hoisted(() => ({
  auth: {} as { currentUser: Ref<{ id: string } | null>; restore: ReturnType<typeof vi.fn> },
  api: vi.fn(),
  upload: vi.fn(),
  cancel: vi.fn(),
  success: vi.fn(),
  leave: null as (() => boolean) | null,
}))
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useMediaUpload', () => () => ({ upload: mocks.upload, cancel: mocks.cancel }))
mockNuxtImport('useToast', () => () => ({ success: mocks.success }))
mockNuxtImport('onBeforeRouteLeave', () => (callback: () => boolean) => {
  mocks.leave = callback
})
mockNuxtImport('onBeforeRouteUpdate', () => () => undefined)
const asset: MediaAsset = {
  id: 'same-media-id',
  name: 'photo.webp',
  url: '/api/v1/media/same-media-id.webp',
  alt: '原始说明',
  width: 1000,
  height: 700,
  byteSize: 4000,
  mimeType: 'image/webp',
  createdAt: '2026-09-10T00:00:00Z',
  deleted: false,
}
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  mocks.auth = { currentUser: ref({ id: 'actor-a' }), restore: vi.fn().mockResolvedValue(true) }
  mocks.api.mockReset().mockImplementation(async () => ({ items: [structuredClone(asset)], total: 1 }))
  mocks.upload.mockReset()
  mocks.cancel.mockReset()
  mocks.success.mockReset()
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
async function setup(initialContext = 'library-a') {
  let state!: ReturnType<typeof useMediaLibrary>, context!: Ref<string>
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        context = useState<string>('page-content-context', () => '')
        context.value = initialContext
        state = useMediaLibrary(true)
        return () => h('div')
      },
    }),
  )
  wrappers.push(wrapper)
  await flushPromises()
  return { state, context, wrapper }
}
const choose = (state: ReturnType<typeof useMediaLibrary>, files: File[]) =>
  state.chooseFiles({ target: { files, value: 'selected' } } as unknown as Event)

it.each(['actor', 'context'])('%s变化立即停用旧图片与写入，旧草稿不能套给新库同编号', async (change) => {
  const { state, context, wrapper } = await setup()
  const original = state.items.value[0]!
  state.altDrafts[original.id] = '尚未提交的旧说明'
  if (change === 'actor') mocks.auth.currentUser.value = { id: 'actor-b' }
  else context.value = 'library-b'
  expect(state.ready.value).toBe(false)
  expect(state.items.value).toEqual([])
  expect(state.canSelect(original)).toBe(false)
  await state.saveAlt(original)
  await state.remove(original)
  await state.restore(original)
  await state.showReferences(original.id)
  await state.load()
  expect(mocks.api).toHaveBeenCalledTimes(1)
  expect(state.altDrafts[original.id]).toBe('尚未提交的旧说明')
  expect(state.busy.value).toBe(true)
  wrapper.unmount()
  mocks.api.mockResolvedValue({ items: [{ ...asset, alt: '新库自己的说明' }], total: 1 })
  const reopened = await setup(context.value)
  expect(reopened.state.altDrafts[original.id]).toBe('新库自己的说明')
  expect(reopened.state.hasDirtyAlt.value).toBe(false)
})
it('原账号恢复并重新读取后，保留自己的未提交替代文本', async () => {
  const { state } = await setup()
  state.altDrafts[asset.id] = '原账号继续编辑的说明'
  mocks.auth.currentUser.value = null
  mocks.auth.currentUser.value = { id: 'actor-a' }
  expect(state.ready.value).toBe(false)
  await state.load()
  expect(state.ready.value).toBe(true)
  expect(state.altDrafts[asset.id]).toBe('原账号继续编辑的说明')
  expect(state.savedAlts[asset.id]).toBe('原始说明')
})
it('队列第一张回包时账号已切换，第二张不上传且两份文件保留供原账号手动重试', async () => {
  const { state } = await setup()
  let finish!: (value: unknown) => void
  mocks.upload.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const files = [new File(['one'], 'one.png'), new File(['two'], 'two.png')]
  choose(state, files)
  await flushPromises()
  const firstId = state.jobs.value[0]!.id
  expect(mocks.upload).toHaveBeenCalledTimes(1)
  mocks.auth.currentUser.value = { id: 'actor-b' }
  expect(mocks.cancel).toHaveBeenCalledOnce()
  const progress = mocks.upload.mock.calls[0]![3] as (value: number) => void
  progress(100)
  finish({ id: firstId })
  await flushPromises()
  expect(mocks.upload).toHaveBeenCalledTimes(1)
  expect(state.jobs.value.map((job) => job.status)).toEqual(['failed', 'failed'])
  expect(state.jobs.value.map((job) => job.file)).toEqual(files)
  state.retry(state.jobs.value[1]!)
  await flushPromises()
  expect(mocks.upload).toHaveBeenCalledTimes(1)
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
  expect(mocks.leave?.()).toBe(false)
  mocks.auth.currentUser.value = { id: 'actor-a' }
  await state.load()
  expect(state.canSelect(state.items.value[0]!)).toBe(false)
  mocks.upload.mockResolvedValue({ id: firstId })
  state.retry(state.jobs.value[0]!)
  await flushPromises()
  expect(mocks.upload).toHaveBeenCalledTimes(2)
  expect(mocks.upload.mock.calls[1]![1]).toBe(firstId)
  expect(state.jobs.value[0]!.status).toBe('done')
  expect(state.jobs.value[1]!.file).toBe(files[1])
  expect(state.jobs.value[1]!.status).toBe('failed')
})
it('旧库列表和保存回包晚到不能重新启用选择或覆盖保留草稿', async () => {
  const { state, context } = await setup()
  const original = state.items.value[0]!
  state.altDrafts[original.id] = '未提交说明'
  let finishSave!: (value: unknown) => void
  mocks.api.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishSave = resolve
      }),
  )
  const saving = state.saveAlt(original)
  let finishList!: (value: unknown) => void
  mocks.api.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishList = resolve
      }),
  )
  const loading = state.load()
  context.value = 'restored-library'
  finishSave({ ...asset, alt: '迟到的旧库响应' })
  finishList({ items: [{ ...asset, alt: '迟到的列表' }], total: 1 })
  await Promise.all([saving, loading])
  expect(state.ready.value).toBe(false)
  expect(state.items.value).toEqual([])
  expect(state.altDrafts[asset.id]).toBe('未提交说明')
  expect(mocks.success).not.toHaveBeenCalled()
})
it('删除引用检查期间内容库恢复时，不发出后续DELETE', async () => {
  const { state, context } = await setup()
  let references!: (value: unknown) => void
  mocks.api.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        references = resolve
      }),
  )
  const remove = state.remove(state.items.value[0]!)
  context.value = 'restored-library'
  references({ total: 0, items: [] })
  await remove
  expect(mocks.api).toHaveBeenCalledTimes(2)
  expect(mocks.api.mock.calls.some((call) => call[1]?.method === 'DELETE')).toBe(false)
})
it('重新读取同编号资源后，先前列表对象不能再触发选择或改写', async () => {
  const { state } = await setup()
  const stale = state.items.value[0]!
  await state.load()
  expect(state.canSelect(stale)).toBe(false)
  expect(state.canSelect(state.items.value[0]!)).toBe(true)
  await state.saveAlt(stale)
  expect(mocks.api).toHaveBeenCalledTimes(2)
})
