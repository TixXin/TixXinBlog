/** @file mediaUploadOwnership.test.ts @description 上传在身份恢复、401重试与迟到回包时保持归属，取消所有并发传输且保留原文件 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useMediaUpload } from '../../app/composables/useMediaUpload'

const mocks = vi.hoisted(() => ({
  auth: {} as {
    currentUser: Ref<{ id: string } | null>
    accessToken: Ref<string | null>
    restore: ReturnType<typeof vi.fn>
    refresh: ReturnType<typeof vi.fn>
  },
}))
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
class UploadRequest {
  static requests: UploadRequest[] = []
  headers: Record<string, string> = {}
  body?: FormData
  status = 0
  response: unknown
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  ontimeout: (() => void) | null = null
  onabort: (() => void) | null = null
  upload = {
    onprogress: null as ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null,
  }
  open = vi.fn()
  abort = vi.fn(() => this.onabort?.())
  constructor() {
    UploadRequest.requests.push(this)
  }
  setRequestHeader(key: string, value: string) {
    this.headers[key] = value
  }
  send(body: FormData) {
    this.body = body
  }
  reply(status: number, response: unknown) {
    this.status = status
    this.response = response
    this.onload?.()
  }
}
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  mocks.auth = {
    currentUser: ref({ id: 'actor-a' }),
    accessToken: ref('token-a'),
    restore: vi.fn().mockResolvedValue(true),
    refresh: vi.fn(),
  }
  UploadRequest.requests = []
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.unstubAllGlobals()
})
async function setup() {
  let uploader!: ReturnType<typeof useMediaUpload>, context!: Ref<string>
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        context = useState<string>('page-content-context', () => '')
        context.value = 'library-a'
        uploader = useMediaUpload()
        return () => h('div')
      },
    }),
  )
  wrappers.push(wrapper)
  vi.stubGlobal('XMLHttpRequest', UploadRequest)
  return { uploader, context, wrapper, file: new File(['photo contents'], 'photo.png', { type: 'image/png' }) }
}
it('同身份刷新令牌后使用相同文件和上传标识重试，保留真实进度', async () => {
  const { uploader, file } = await setup()
  mocks.auth.refresh.mockImplementation(async () => {
    mocks.auth.accessToken.value = 'token-a-refreshed'
    return true
  })
  const progress = vi.fn()
  const upload = uploader.upload(file, 'same-upload-id', '照片说明', progress)
  await flushPromises()
  const first = UploadRequest.requests[0]!
  first.upload.onprogress?.({ lengthComputable: true, loaded: 3, total: 10 })
  first.reply(401, { message: '过期' })
  await flushPromises()
  const retry = UploadRequest.requests[1]!
  expect(retry.headers).toEqual({ Authorization: 'Bearer token-a-refreshed', 'X-Content-Context': 'library-a' })
  expect(retry.body?.get('uploadId')).toBe('same-upload-id')
  expect(retry.body?.get('alt')).toBe('照片说明')
  expect((retry.body?.get('file') as File).name).toBe(file.name)
  expect((retry.body?.get('file') as File).size).toBe(file.size)
  retry.upload.onprogress?.({ lengthComputable: true, loaded: 10, total: 10 })
  retry.reply(201, { data: { id: 'saved-media' } })
  await expect(upload).resolves.toEqual({ id: 'saved-media' })
  expect(progress.mock.calls).toEqual([[30], [100]])
  expect(file.name).toBe('photo.png')
  expect(file.size).toBe(14)
})
it.each(['actor', 'context'])('首次恢复期间%s变化时不发送文件', async (change) => {
  const { uploader, file, context } = await setup()
  mocks.auth.restore.mockImplementation(async () => {
    if (change === 'actor') mocks.auth.currentUser.value = { id: 'actor-b' }
    else context.value = 'library-b'
    return true
  })
  await expect(uploader.upload(file, 'upload-id', '', vi.fn())).rejects.toMatchObject({ statusCode: 409 })
  expect(UploadRequest.requests).toHaveLength(0)
  expect(file.size).toBe(14)
})
it.each(['actor', 'context'])('401刷新期间%s变化时不重放文件', async (change) => {
  const { uploader, file, context } = await setup()
  mocks.auth.refresh.mockImplementation(async () => {
    if (change === 'actor') mocks.auth.currentUser.value = { id: 'actor-b' }
    else context.value = 'library-b'
    return true
  })
  const upload = uploader.upload(file, 'upload-id', '', vi.fn())
  const rejected = expect(upload).rejects.toMatchObject({ statusCode: 409 })
  await flushPromises()
  UploadRequest.requests[0]!.reply(401, {})
  await rejected
  expect(UploadRequest.requests).toHaveLength(1)
})
it.each(['actor', 'context'])('迟到成功回包时%s变化，不向调用方返回旧媒体', async (change) => {
  const { uploader, file, context } = await setup()
  const upload = uploader.upload(file, 'upload-id', '', vi.fn())
  const rejected = expect(upload).rejects.toMatchObject({ statusCode: 409 })
  await flushPromises()
  if (change === 'actor') mocks.auth.currentUser.value = { id: 'actor-b' }
  else context.value = 'library-b'
  UploadRequest.requests[0]!.reply(201, { data: { id: 'old-media' } })
  await rejected
  expect(mocks.auth.refresh).not.toHaveBeenCalled()
})
it('收到401之前已换账号时，不刷新新账号或重放原文件', async () => {
  const { uploader, file } = await setup()
  const upload = uploader.upload(file, 'upload-id', '', vi.fn())
  const rejected = expect(upload).rejects.toMatchObject({ statusCode: 409 })
  await flushPromises()
  mocks.auth.currentUser.value = { id: 'actor-b' }
  UploadRequest.requests[0]!.reply(401, {})
  await rejected
  expect(mocks.auth.refresh).not.toHaveBeenCalled()
})
it('并发上传中一条完成后卸载仍取消其余传输', async () => {
  const { uploader, file, wrapper } = await setup()
  const first = uploader.upload(file, 'first', '', vi.fn())
  const second = uploader.upload(file, 'second', '', vi.fn())
  const cancelled = expect(second).rejects.toThrow('取消')
  await flushPromises()
  const [one, two] = UploadRequest.requests
  one!.reply(201, { data: { id: 'first' } })
  await first
  wrapper.unmount()
  await cancelled
  expect(one!.abort).not.toHaveBeenCalled()
  expect(two!.abort).toHaveBeenCalledOnce()
})
it('恢复或刷新尚未结束时取消，不会在等待结束后重新发送', async () => {
  const { uploader, file } = await setup()
  let restore!: (value: boolean) => void
  mocks.auth.restore.mockImplementation(
    () =>
      new Promise<boolean>((resolve) => {
        restore = resolve
      }),
  )
  const upload = uploader.upload(file, 'restore-pending', '', vi.fn())
  const cancelled = expect(upload).rejects.toThrow('取消')
  uploader.cancel()
  restore(true)
  await cancelled
  expect(UploadRequest.requests).toHaveLength(0)
  mocks.auth.restore.mockResolvedValue(true)
  let refresh!: (value: boolean) => void
  mocks.auth.refresh.mockImplementation(
    () =>
      new Promise<boolean>((resolve) => {
        refresh = resolve
      }),
  )
  const retry = uploader.upload(file, 'refresh-pending', '', vi.fn())
  const retryCancelled = expect(retry).rejects.toThrow('取消')
  await flushPromises()
  UploadRequest.requests[0]!.reply(401, {})
  await flushPromises()
  uploader.cancel()
  refresh(true)
  await retryCancelled
  expect(UploadRequest.requests).toHaveLength(1)
})
