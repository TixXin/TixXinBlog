/** @file contentBackupOwnership.test.ts @description 内容包上传下载在认证刷新、账号变化与内容恢复时保留提交快照和票据，拒绝跨边界响应 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { Ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useContentBackup } from '../../app/composables/useContentBackup'
import type { ContentImportView } from '../../app/features/backup/types'

const mocks = vi.hoisted(() => ({
  auth: {} as {
    currentUser: Ref<{ id: string } | null>
    accessToken: Ref<string | null>
    restore: ReturnType<typeof vi.fn>
    refresh: ReturnType<typeof vi.fn>
  },
  api: vi.fn(),
  fetch: Object.assign(vi.fn(), { raw: vi.fn() }),
  refreshSite: vi.fn(),
  success: vi.fn(),
}))
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useSiteSettings', () => () => ({ refresh: mocks.refreshSite }))
mockNuxtImport('useToast', () => () => ({ success: mocks.success }))
mockNuxtImport('$fetch', () => mocks.fetch)
mockNuxtImport('onBeforeRouteLeave', () => () => undefined)
const wrappers: { unmount(): void }[] = []
const source = () => new File(['{"format":"tixxin-content","version":4}'], 'gallery.json', { type: 'application/json' })
const ticket = (id: string, completed = false): ContentImportView => ({
  ticket: id,
  confirmation: 'a'.repeat(64),
  strategy: 'skip',
  includeSettings: false,
  createdAt: '2026-09-10T10:00:00Z',
  expiresAt: '2026-09-10T10:15:00Z',
  started: completed,
  completed,
  expired: false,
  plan: {
    ready: true,
    errors: [],
    posts: [],
    flashes: [],
    gallery: [],
    counts: { posts: 0, flashes: 0, gallery: 1, comments: 0, skipped: 0, media: 1, files: 1, settings: false },
  },
})
beforeEach(() => {
  mocks.auth = {
    currentUser: ref({ id: 'actor-a' }),
    accessToken: ref('token-a'),
    restore: vi.fn().mockResolvedValue(true),
    refresh: vi.fn().mockResolvedValue(true),
  }
  mocks.api.mockReset().mockResolvedValue([])
  mocks.fetch.mockReset()
  mocks.fetch.raw.mockReset()
  mocks.success.mockReset()
  mocks.refreshSite.mockReset()
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
async function setup(waitForRecent = true) {
  let state!: ReturnType<typeof useContentBackup>, context!: Ref<string>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          context = useState<string>('page-content-context', () => '')
          context.value = 'library-a'
          state = useContentBackup()
          return () => h('div')
        },
      }),
      { route: '/admin/maintenance' },
    ),
  )
  if (waitForRecent) await vi.waitFor(() => expect(mocks.api).toHaveBeenCalledWith('/admin/backup/imports'))
  mocks.api.mockClear()
  vi.stubGlobal('$fetch', mocks.fetch)
  return { state, context }
}
it('同一身份刷新重试保持FormData原始文件、上传标识及选项', async () => {
  const { state } = await setup()
  const file = source()
  state.choose(file)
  const id = state.requestId.value
  mocks.fetch.mockRejectedValueOnce({ statusCode: 401 }).mockResolvedValueOnce({ data: ticket(id) })
  mocks.auth.refresh.mockImplementation(async () => {
    mocks.auth.accessToken.value = 'token-a-refreshed'
    return true
  })
  await state.preview()
  expect(mocks.fetch).toHaveBeenCalledTimes(2)
  const initial = mocks.fetch.mock.calls[0]![1],
    retried = mocks.fetch.mock.calls[1]![1]
  expect(initial.body).toBeInstanceOf(FormData)
  expect(retried.body).toBe(initial.body)
  const uploaded = retried.body.get('file') as File
  expect(uploaded.name).toBe(file.name)
  expect(uploaded.type).toBe(file.type)
  expect(await uploaded.text()).toBe(await file.text())
  expect(retried.body.get('requestId')).toBe(id)
  expect(retried.body.get('strategy')).toBe('skip')
  expect(retried.headers).toEqual({ Authorization: 'Bearer token-a-refreshed', 'X-Content-Context': 'library-a' })
  expect(state.job.value?.ticket).toBe(id)
})
it('刷新进入另一账号时不重传原包，切回后文件和未知票据仍可查询', async () => {
  const { state } = await setup()
  const file = source()
  state.choose(file)
  const id = state.requestId.value
  mocks.fetch.mockRejectedValueOnce({ statusCode: 401 })
  mocks.auth.refresh.mockImplementation(async () => {
    mocks.auth.currentUser.value = { id: 'actor-b' }
    mocks.auth.accessToken.value = 'token-b'
    return true
  })
  await state.preview()
  expect(mocks.fetch).toHaveBeenCalledTimes(1)
  expect(state.job.value).toBeNull()
  expect(state.file.value).toBeNull()
  expect(state.error.value).toContain('已变化')
  mocks.auth.currentUser.value = { id: 'actor-a' }
  mocks.auth.accessToken.value = 'token-a-new'
  expect(state.file.value).toBe(file)
  expect(state.requestId.value).toBe(id)
  mocks.api.mockImplementation(async (path: string) => (path.endsWith(id) ? ticket(id) : []))
  await state.read()
  expect(state.job.value?.ticket).toBe(id)
})
it('内容恢复期间拒绝重放旧包，原文件和票据保留且旧预览隐藏', async () => {
  const { state, context } = await setup()
  const file = source()
  state.choose(file)
  const id = state.requestId.value
  mocks.fetch.mockRejectedValueOnce({ statusCode: 401 })
  mocks.auth.refresh.mockImplementation(async () => {
    context.value = 'restored-library'
    return true
  })
  await state.preview()
  expect(mocks.fetch).toHaveBeenCalledTimes(1)
  expect(state.file.value).toBe(file)
  expect(state.requestId.value).toBe(id)
  expect(state.job.value).toBeNull()
  expect(state.error.value).toContain('内容库已变化')
})
it('身份恢复在首个请求前换账号时不发送上传', async () => {
  const { state } = await setup()
  state.choose(source())
  mocks.auth.restore.mockImplementation(async () => {
    mocks.auth.currentUser.value = { id: 'actor-b' }
    return true
  })
  await state.preview()
  expect(mocks.fetch).not.toHaveBeenCalled()
  expect(state.job.value).toBeNull()
})
it('票据与最近记录的迟到响应不能显示在新账号，旧操作不结束新请求', async () => {
  const { state } = await setup()
  let finishOld!: (value: ContentImportView) => void
  let finishNew!: (value: ContentImportView) => void
  mocks.api.mockImplementation((path: string) =>
    path.endsWith('old-ticket')
      ? new Promise((resolve) => {
          finishOld = resolve
        })
      : path.endsWith('new-ticket')
        ? new Promise((resolve) => {
            finishNew = resolve
          })
        : Promise.resolve([]),
  )
  const old = state.read('old-ticket')
  await vi.waitFor(() => expect(finishOld).toBeTypeOf('function'))
  mocks.auth.currentUser.value = { id: 'actor-b' }
  const current = state.read('new-ticket')
  await vi.waitFor(() => expect(finishNew).toBeTypeOf('function'))
  finishOld(ticket('old-ticket'))
  await old
  expect(state.job.value).toBeNull()
  expect(state.pending.value).toBe(true)
  finishNew(ticket('new-ticket'))
  await current
  expect(state.job.value?.ticket).toBe('new-ticket')
  mocks.auth.currentUser.value = { id: 'actor-a' }
  expect(state.job.value).toBeNull()
  expect(state.recent.value).toEqual([])
})
it('导出刷新时冻结包含媒体选择，Blob下载保持原始文件名', async () => {
  const { state } = await setup()
  const blob = new Blob(['content'], { type: 'application/json' })
  const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:content-package')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.download).toBe('gallery-backup.json')
  })
  mocks.fetch.raw.mockRejectedValueOnce({ statusCode: 401 }).mockResolvedValueOnce({
    _data: blob,
    headers: new Headers({ 'content-disposition': 'attachment; filename="gallery-backup.json"' }),
  })
  mocks.auth.refresh.mockImplementation(async () => {
    state.mediaIncluded.value = false
    return true
  })
  await state.exportPackage()
  expect(mocks.fetch.raw).toHaveBeenCalledTimes(2)
  expect(mocks.fetch.raw.mock.calls[1]![1].body).toEqual({ mediaIncluded: true })
  expect(create).toHaveBeenCalledWith(blob)
  expect(click).toHaveBeenCalledTimes(1)
})
it('导出期间账号变化或组件卸载不能触发迟到下载', async () => {
  const { state } = await setup()
  let finish!: (value: unknown) => void
  mocks.fetch.raw.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:unexpected')
  const exporting = state.exportPackage()
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  wrappers.pop()!.unmount()
  finish({ _data: new Blob(['private data']), headers: new Headers() })
  await exporting
  expect(create).not.toHaveBeenCalled()
  expect(mocks.success).not.toHaveBeenCalled()
})
it('初次身份恢复期间已选文件和上传标识不丢失', async () => {
  mocks.auth.currentUser.value = null
  let finishRestore!: (value: boolean) => void
  const restoring = new Promise<boolean>((resolve) => {
    finishRestore = resolve
  })
  mocks.auth.restore.mockImplementation(() => restoring)
  const { state } = await setup(false)
  const file = source()
  state.choose(file)
  const id = state.requestId.value
  mocks.fetch.mockResolvedValue({ data: ticket(id) })
  const previewing = state.preview()
  mocks.auth.currentUser.value = { id: 'actor-a' }
  expect(state.pending.value).toBe(true)
  finishRestore(true)
  await previewing
  expect(state.file.value).toBe(file)
  expect(state.requestId.value).toBe(id)
  expect(state.job.value?.ticket).toBe(id)
})
it('导入确认冻结摘要，内容库变化后不接受迟到完成或更新站点资料', async () => {
  const { state, context } = await setup()
  const file = source()
  state.choose(file)
  const id = state.requestId.value
  mocks.api.mockImplementation(async (path: string) => (path.endsWith(id) ? ticket(id) : []))
  await state.read(id)
  state.acknowledgement.value = '导入为新草稿'
  let finish!: (value: ContentImportView) => void
  mocks.api.mockImplementation((path: string) =>
    path.endsWith('/execute')
      ? new Promise((resolve) => {
          finish = resolve
        })
      : Promise.resolve([]),
  )
  const executing = state.execute()
  state.job.value!.confirmation = 'b'.repeat(64)
  state.acknowledgement.value = ''
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  expect(mocks.api).toHaveBeenLastCalledWith(`/admin/backup/imports/${id}/execute`, {
    method: 'POST',
    body: { acknowledgement: '导入为新草稿', confirmation: 'a'.repeat(64) },
    timeout: 120000,
  })
  context.value = 'restored-library'
  finish({ ...ticket(id, true), result: { posts: [], flashes: [], comments: 0, media: 0, files: 0, settings: true } })
  await executing
  expect(state.job.value).toBeNull()
  expect(state.file.value).toBe(file)
  expect(state.requestId.value).toBe(id)
  expect(mocks.refreshSite).not.toHaveBeenCalled()
  expect(mocks.success).not.toHaveBeenCalled()
})
it('最近票据迟到响应不会覆盖另一账号的列表', async () => {
  const { state } = await setup()
  let finish!: (value: unknown) => void
  mocks.api.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const reading = state.loadRecent()
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  mocks.auth.currentUser.value = { id: 'actor-b' }
  mocks.api.mockResolvedValue([{ ticket: 'new-owner-ticket' }])
  await state.loadRecent()
  finish([{ ticket: 'old-owner-ticket' }])
  await reading
  expect(state.recent.value).toEqual([{ ticket: 'new-owner-ticket' }])
})
it('统一管理接口已处理过401时不在内容维护外层再次刷新或重放执行', async () => {
  const { state } = await setup()
  mocks.api.mockRejectedValue({ statusCode: 401 })
  await state.read('known-ticket')
  expect(mocks.api).toHaveBeenCalledTimes(1)
  expect(mocks.auth.refresh).not.toHaveBeenCalled()
  expect(state.job.value).toBeNull()
  expect(state.pending.value).toBe(false)
})
it('同一账号和内容库确认导入后正常接受完成结果并刷新设置', async () => {
  const { state } = await setup()
  const id = 'known-ticket'
  const completed = {
    ...ticket(id, true),
    result: { posts: [], flashes: [], comments: 0, media: 0, files: 0, settings: true },
  }
  mocks.api.mockImplementation(async (path: string) =>
    path.endsWith('/execute') ? completed : path.endsWith(id) ? ticket(id) : [],
  )
  await state.read(id)
  state.acknowledgement.value = '导入为新草稿'
  await state.execute()
  expect(state.job.value?.completed).toBe(true)
  expect(state.error.value).toBe('')
  expect(mocks.refreshSite).toHaveBeenCalledTimes(1)
  expect(mocks.success).toHaveBeenCalledWith('内容已迁入为新草稿')
})
