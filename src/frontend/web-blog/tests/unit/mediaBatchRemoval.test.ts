/**
 * @file mediaBatchRemoval.test.ts
 * @description 媒体批量回收只处理当前工作区的未引用资源，逐项保留结果并隔离迟到响应。
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useMediaLibrary } from '../../app/composables/useMediaLibrary'
import type { MediaAsset, MediaReferences } from '../../app/features/media/types'

const mocks = vi.hoisted(() => ({
  auth: {} as { currentUser: Ref<{ id: string } | null>; restore: ReturnType<typeof vi.fn> },
  api: vi.fn(),
  cancel: vi.fn(),
  success: vi.fn(),
}))
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useMediaUpload', () => () => ({ upload: vi.fn(), cancel: mocks.cancel }))
mockNuxtImport('useToast', () => () => ({ success: mocks.success }))
mockNuxtImport('onBeforeRouteLeave', () => () => undefined)
mockNuxtImport('onBeforeRouteUpdate', () => () => undefined)

const assets: MediaAsset[] = ['山间晨光', '雨后庭院', '街角晚霞'].map((name, index) => ({
  id: `media-${index + 1}`,
  name: `${name}.webp`,
  url: `/api/v1/media/media-${index + 1}.webp`,
  alt: name,
  description: `${name}的拍摄记录`,
  width: 1000,
  height: 700,
  byteSize: 4000,
  mimeType: 'image/webp',
  createdAt: '2026-10-10T00:00:00Z',
  deleted: false,
}))
const emptyReferences = (): MediaReferences => ({ total: 0, page: 1, pageSize: 20, items: [] })
const historicalReference: MediaReferences = {
  total: 1,
  page: 1,
  pageSize: 20,
  items: [{ kind: 'revision', title: '秋日徒步', url: '/admin/posts/post-a', revision: 3 }],
}
const wrappers: { unmount(): void }[] = []
type ApiOptions = { method?: string; query?: Record<string, unknown> }
const defaultResponse = async (path: string, options?: ApiOptions) => {
  if (path === '/admin/media') return { items: structuredClone(assets), total: 41 }
  if (path.endsWith('/references')) return emptyReferences()
  if (options?.method === 'DELETE') return { deleted: true }
  throw new Error(`未声明的请求：${path}`)
}

beforeEach(() => {
  mocks.auth = { currentUser: ref({ id: 'actor-a' }), restore: vi.fn().mockResolvedValue(true) }
  mocks.api.mockReset().mockImplementation(defaultResponse)
  mocks.cancel.mockReset()
  mocks.success.mockReset()
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function setup(selectable = false) {
  let state!: ReturnType<typeof useMediaLibrary>, context!: Ref<string>
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        context = useState<string>('page-content-context', () => '')
        context.value = 'library-a'
        state = useMediaLibrary(selectable)
        return () => h('div')
      },
    }),
    { route: '/admin/media' },
  )
  wrappers.push(wrapper)
  await flushPromises()
  return { state, context }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const deletedPaths = () => mocks.api.mock.calls.filter((call) => call[1]?.method === 'DELETE').map((call) => call[0])

it('当前页全选与半选只包含有效资源，旧列表对象和回收资源不能进入批量选择', async () => {
  mocks.api.mockResolvedValueOnce({
    items: [...structuredClone(assets), { ...assets[0]!, id: 'recycled-media', deleted: true }],
    total: 4,
  })
  const { state } = await setup()
  const first = state.items.value[0]!
  state.toggleSelection({ ...first })
  state.toggleSelection(state.items.value[3]!)
  expect(state.selectedIds.value).toEqual([])
  state.toggleSelection(first)
  expect(state.selectedIds.value).toEqual([first.id])
  expect(state.someSelected.value).toBe(true)
  expect(state.allSelected.value).toBe(false)
  state.toggleAll()
  expect(state.selectedIds.value).toEqual(assets.map((asset) => asset.id))
  expect(state.allSelected.value).toBe(true)
  expect(state.someSelected.value).toBe(false)
  state.toggleAll()
  expect(state.selectedIds.value).toEqual([])
  expect(state.allSelected.value).toBe(false)
  state.toggleSelection(first)
  state.clearSelection()
  expect(state.selectedIds.value).toEqual([])
})

it('嵌入编辑表单的媒体选择器不提供批量回收', async () => {
  const { state } = await setup(true)
  expect(state.canBatchSelect.value).toBe(false)
  state.toggleSelection(state.items.value[0]!)
  state.toggleAll()
  await state.removeSelected()
  expect(state.selectedIds.value).toEqual([])
  expect(mocks.api).toHaveBeenCalledTimes(1)
  expect(window.confirm).not.toHaveBeenCalled()
})

it('回收视图不能选择资源或执行批量回收', async () => {
  const { state } = await setup()
  state.deleted.value = 'true'
  await state.searchMedia()
  await flushPromises()
  expect(state.canBatchSelect.value).toBe(false)
  state.toggleAll()
  state.toggleSelection(state.items.value[0]!)
  await state.removeSelected()
  expect(state.selectedIds.value).toEqual([])
  expect(deletedPaths()).toEqual([])
  expect(window.confirm).not.toHaveBeenCalled()
})

it.each(['alt', 'description'])('有未保存的%s时不增加选择，也不执行已经选择的批量回收', async (field) => {
  const { state } = await setup()
  state.toggleSelection(state.items.value[0]!)
  const drafts = field === 'alt' ? state.altDrafts : state.descriptionDrafts
  drafts[assets[0]!.id] = '尚未提交的编辑内容'
  expect(state.canBatchSelect.value).toBe(false)
  state.toggleSelection(state.items.value[1]!)
  state.toggleAll()
  await state.removeSelected()
  expect(state.selectedIds.value).toEqual([assets[0]!.id])
  expect(mocks.api).toHaveBeenCalledTimes(1)
  expect(window.confirm).not.toHaveBeenCalled()
})

it('开始重新读取立即清空选择，等待期间不能重新选择旧列表或回收', async () => {
  const { state } = await setup()
  const stale = state.items.value[0]!
  state.toggleSelection(stale)
  const list = deferred<{ items: MediaAsset[]; total: number }>()
  mocks.api.mockImplementationOnce(() => list.promise)
  const loading = state.load()
  expect(state.selectedIds.value).toEqual([])
  expect(state.canBatchSelect.value).toBe(false)
  state.toggleSelection(stale)
  state.toggleAll()
  await state.removeSelected()
  expect(window.confirm).not.toHaveBeenCalled()
  expect(mocks.api).toHaveBeenCalledTimes(2)
  list.resolve({ items: structuredClone(assets), total: 3 })
  await loading
  expect(state.canBatchSelect.value).toBe(true)
  state.toggleSelection(stale)
  expect(state.selectedIds.value).toEqual([])
})

it.each(['page', 'filter'])('切换%s后清空选择，不将上一页或筛选前的选择带入下一批', async (change) => {
  const { state } = await setup()
  state.toggleAll()
  if (change === 'page') await state.changePage(2)
  else {
    state.usage.value = 'unused'
    await state.searchMedia()
  }
  await flushPromises()
  expect(state.selectedIds.value).toEqual([])
  expect(mocks.api).toHaveBeenLastCalledWith('/admin/media', {
    query: expect.objectContaining(change === 'page' ? { page: 2 } : { page: 1, usage: 'unused' }),
  })
})

it('一次确认后逐项检查真实引用，只回收未引用资源并保留可定位的历史引用结果', async () => {
  const { state } = await setup()
  mocks.api.mockImplementation(async (path: string, options?: ApiOptions) => {
    if (path === '/admin/media/media-2/references') return structuredClone(historicalReference)
    return defaultResponse(path, options)
  })
  state.toggleAll()
  await state.removeSelected()
  expect(window.confirm).toHaveBeenCalledOnce()
  expect(deletedPaths()).toEqual(['/admin/media/media-1', '/admin/media/media-3'])
  expect(state.batchResults.value).toEqual([
    expect.objectContaining({ id: 'media-1', name: assets[0]!.name, status: 'removed' }),
    expect.objectContaining({
      id: 'media-2',
      name: assets[1]!.name,
      status: 'referenced',
      references: historicalReference,
    }),
    expect.objectContaining({ id: 'media-3', name: assets[2]!.name, status: 'removed' }),
  ])
  expect(state.batchResults.value.every((result) => result.message.length > 0)).toBe(true)
  expect(state.selectedIds.value).toEqual([])
  expect(state.batchProgress.value).toBeNull()
  expect(mocks.api).toHaveBeenLastCalledWith('/admin/media', expect.any(Object))
})

it('引用检查失败时保留失败项且不发送该项DELETE，后续未引用资源继续回收', async () => {
  const { state } = await setup()
  mocks.api.mockImplementation(async (path: string, options?: ApiOptions) => {
    if (path === '/admin/media/media-1/references') throw new Error('引用查询暂时不可用')
    return defaultResponse(path, options)
  })
  state.toggleAll()
  await state.removeSelected()
  expect(deletedPaths()).toEqual(['/admin/media/media-2', '/admin/media/media-3'])
  expect(state.batchResults.value.map((result) => result.status)).toEqual(['failed', 'removed', 'removed'])
  expect(state.batchResults.value[0]?.message).toBeTruthy()
})

it('单项DELETE失败后不影响其他项，失败结果保留到列表重新读取之后', async () => {
  const { state } = await setup()
  mocks.api.mockImplementation(async (path: string, options?: ApiOptions) => {
    if (path === '/admin/media/media-1' && options?.method === 'DELETE') throw new Error('存储暂时不可用')
    return defaultResponse(path, options)
  })
  state.toggleAll()
  await state.removeSelected()
  expect(deletedPaths()).toEqual(assets.map((asset) => `/admin/media/${asset.id}`))
  expect(state.batchResults.value.map((result) => result.status)).toEqual(['failed', 'removed', 'removed'])
  expect(state.batchResults.value[0]?.message).toBeTruthy()
  expect(state.selectedIds.value).toEqual([])
})

it('预查后新增引用导致DELETE被拒绝时，重新查询并展示新增的引用位置', async () => {
  const { state } = await setup()
  let referenceReads = 0
  mocks.api.mockImplementation(async (path: string, options?: ApiOptions) => {
    if (path === '/admin/media/media-1/references') {
      referenceReads++
      return referenceReads === 1 ? emptyReferences() : structuredClone(historicalReference)
    }
    if (path === '/admin/media/media-1' && options?.method === 'DELETE') {
      throw new Error('资源已有新的引用')
    }
    return defaultResponse(path, options)
  })
  state.toggleSelection(state.items.value[0]!)
  state.toggleSelection(state.items.value[1]!)
  await state.removeSelected()
  expect(referenceReads).toBe(2)
  expect(state.batchResults.value).toEqual([
    expect.objectContaining({ id: 'media-1', status: 'referenced', references: historicalReference }),
    expect.objectContaining({ id: 'media-2', status: 'removed' }),
  ])
})

it('取消批量确认不查询引用、不发送删除，并保留当前选择', async () => {
  const { state } = await setup()
  vi.mocked(window.confirm).mockReturnValue(false)
  state.toggleAll()
  await state.removeSelected()
  expect(window.confirm).toHaveBeenCalledOnce()
  expect(mocks.api).toHaveBeenCalledTimes(1)
  expect(state.selectedIds.value).toEqual(assets.map((asset) => asset.id))
  expect(state.batchResults.value).toEqual([])
})

it.each([
  ['actor', 'references'],
  ['context', 'references'],
  ['actor', 'delete'],
  ['context', 'delete'],
])('%s变化发生在%s等待期间时清空结果，迟到响应不能继续回收下一项', async (change, stage) => {
  const { state, context } = await setup()
  const waiting = deferred<unknown>()
  mocks.api.mockImplementation(async (path: string, options?: ApiOptions) => {
    if (
      (stage === 'references' && path === '/admin/media/media-2/references') ||
      (stage === 'delete' && path === '/admin/media/media-2' && options?.method === 'DELETE')
    ) {
      return waiting.promise
    }
    return defaultResponse(path, options)
  })
  state.toggleAll()
  const removal = state.removeSelected()
  await flushPromises()
  expect(state.batchProgress.value).toEqual({ completed: 1, total: 3 })
  expect(state.batchResults.value).toEqual([expect.objectContaining({ id: 'media-1', status: 'removed' })])
  expect(state.canBatchSelect.value).toBe(false)
  if (change === 'actor') mocks.auth.currentUser.value = { id: 'actor-b' }
  else context.value = 'restored-library'
  expect(state.selectedIds.value).toEqual([])
  expect(state.batchResults.value).toEqual([])
  expect(state.ready.value).toBe(false)
  waiting.resolve(stage === 'references' ? emptyReferences() : { deleted: true })
  await removal
  expect(mocks.api.mock.calls.some((call) => call[0].includes('media-3'))).toBe(false)
  expect(deletedPaths()).toEqual(
    stage === 'delete' ? ['/admin/media/media-1', '/admin/media/media-2'] : ['/admin/media/media-1'],
  )
  expect(state.batchResults.value).toEqual([])
  expect(state.batchProgress.value).toBeNull()
  expect(mocks.success).not.toHaveBeenCalled()
})

it('被引用项不在刷新后的列表中时，仍可从批量结果继续查询其引用', async () => {
  const { state } = await setup()
  mocks.api.mockImplementation(async (path: string, options?: ApiOptions) => {
    if (path === '/admin/media') return { items: [], total: 0 }
    if (path === '/admin/media/media-1/references') return structuredClone(historicalReference)
    return defaultResponse(path, options)
  })
  state.toggleSelection(state.items.value[0]!)
  await state.removeSelected()
  expect(state.items.value).toEqual([])
  await state.showReferences('media-1')
  expect(state.referenceId.value).toBe('media-1')
  expect(state.referenceName.value).toBe(assets[0]!.name)
  expect(state.references.value).toEqual(historicalReference)
  expect(mocks.api).toHaveBeenLastCalledWith('/admin/media/media-1/references', { query: { page: 1 } })
})

it('切换资源后引用查询失败不会将上一张图片的引用显示在新图片下', async () => {
  const { state } = await setup()
  mocks.api.mockResolvedValueOnce(structuredClone(historicalReference))
  await state.showReferences('media-1')
  expect(state.references.value).toEqual(historicalReference)
  const waiting = deferred<MediaReferences>()
  mocks.api.mockImplementationOnce(() => waiting.promise.then(() => Promise.reject(new Error('读取失败'))))
  const reading = state.showReferences('media-2')
  expect(state.referenceId.value).toBe('media-2')
  expect(state.referenceName.value).toBe(assets[1]!.name)
  expect(state.referenceLoading.value).toBe(true)
  expect(state.references.value).toBeNull()
  waiting.resolve(emptyReferences())
  await reading
  expect(state.references.value).toBeNull()
  expect(state.referenceError.value).toBeTruthy()
  expect(state.referenceLoading.value).toBe(false)
})

it('关闭引用面板后晚到回包不能重新打开面板或留下过期引用', async () => {
  const { state } = await setup()
  const waiting = deferred<MediaReferences>()
  mocks.api.mockImplementationOnce(() => waiting.promise)
  const reading = state.showReferences('media-1')
  expect(state.referenceLoading.value).toBe(true)
  state.closeReferences()
  waiting.resolve(structuredClone(historicalReference))
  await reading
  expect(state.referenceId.value).toBe('')
  expect(state.referenceName.value).toBe('')
  expect(state.references.value).toBeNull()
  expect(state.referenceError.value).toBe('')
  expect(state.referenceLoading.value).toBe(false)
})

it('连续查看两张图片时，第一张迟到的引用不能覆盖当前图片', async () => {
  const { state } = await setup()
  const previous = deferred<MediaReferences>()
  mocks.api.mockImplementationOnce(() => previous.promise)
  const firstReading = state.showReferences('media-1')
  const currentReference: MediaReferences = {
    total: 1,
    page: 1,
    pageSize: 20,
    items: [{ kind: 'gallery', title: '庭院的一天', url: '/admin/gallery/photo-b' }],
  }
  mocks.api.mockResolvedValueOnce(currentReference)
  await state.showReferences('media-2')
  previous.resolve(structuredClone(historicalReference))
  await firstReading
  expect(state.referenceId.value).toBe('media-2')
  expect(state.referenceName.value).toBe(assets[1]!.name)
  expect(state.references.value).toEqual(currentReference)
  expect(state.referenceLoading.value).toBe(false)
})
