/** @file promptDetail.test.ts @description 公开详情的首屏读取与 payload 复用，以及客户端私有读取和迟到响应所有权。 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, onMounted, ref } from 'vue'
import type { Ref } from 'vue'
import type { Router } from 'vue-router'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { PROMPT_DETAIL_DATA_KEY, usePromptDetail } from '../../app/composables/usePromptDetail'
import type { ImagePrompt, ManagedPrompt } from '../../app/features/prompt/types'

const mocks = vi.hoisted(() => ({
  detail: vi.fn(),
  adminDetail: vi.fn(),
  auth: {} as { currentUser: Ref<{ id: string } | null>; isLoggedIn: Ref<boolean> },
}))
mockNuxtImport('usePromptRepository', () => () => ({ detail: mocks.detail, adminDetail: mocks.adminDetail }))
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
function item(id = 7, title = '窗边的光'): ImagePrompt {
  return {
    id,
    title,
    description: '柔和光影',
    prompt: 'A quiet room',
    negativePrompt: '',
    model: 'Flux',
    tags: ['光影'],
    imageUrl: `/api/v1/media/image-${id}.webp`,
    imageAlt: title,
    width: 1200,
    height: 800,
    sourceUrl: '',
    publishedAt: '2026-10-03',
  }
}
function draft(title = '私有草稿'): ManagedPrompt {
  return {
    ...item(7, title),
    status: 'draft',
    mediaId: 'image-7',
    externalImageUrl: null,
    revision: 1,
    createdAt: '2026-10-03',
    updatedAt: '2026-10-03',
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const cleanup: (() => void)[] = []
beforeEach(() => {
  mocks.auth = { currentUser: ref(null), isLoggedIn: ref(false) }
  mocks.detail.mockReset().mockImplementation(async (id: number) => item(id))
  mocks.adminDetail.mockReset().mockResolvedValue(draft())
})
afterEach(async () => {
  cleanup
    .splice(0)
    .reverse()
    .forEach((dispose) => dispose())
  await flushPromises()
})
async function setup(path: string, payload?: unknown) {
  let state!: Awaited<ReturnType<typeof usePromptDetail>>
  let app!: ReturnType<typeof useNuxtApp>
  let router!: Router
  let context!: Ref<string>
  let wasHydrating = false
  let wasServerRendered: boolean | undefined
  let mounted = false
  const ready = ref(true)
  const reads: { id: number; mounted: boolean }[] = []
  const read = mocks.detail.getMockImplementation()!
  mocks.detail.mockImplementation((id: number, signal: AbortSignal) => {
    reads.push({ id, mounted })
    return read(id, signal)
  })
  const wrapper = await mountSuspended(
    defineComponent({
      async setup() {
        app = useNuxtApp()
        router = useRouter()
        const route = useRoute()
        context = useState<string>('page-content-context', () => '')
        context.value = ''
        clearNuxtData(PROMPT_DETAIL_DATA_KEY)
        wasHydrating = app.isHydrating
        wasServerRendered = app.payload.serverRendered
        if (payload) {
          app.isHydrating = true
          app.payload.serverRendered = true
          app.payload.data[PROMPT_DETAIL_DATA_KEY] = payload
        }
        onMounted(() => {
          mounted = true
        })
        state = await usePromptDetail(
          ready,
          computed(() => mocks.auth.isLoggedIn.value && route.query.view === 'drafts'),
        )
        // 异步 setup 结束前仅允许公开读取；私有数据不能进入 SSR/payload 阶段。
        expect(mocks.adminDetail).not.toHaveBeenCalled()
        return () => h('p', state.selectedItem.value?.title)
      },
    }),
    { route: path },
  )
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    wrapper.unmount()
    app.isHydrating = wasHydrating
    app.payload.serverRendered = wasServerRendered
  }
  cleanup.push(dispose)
  await flushPromises()
  return { state, app, router, context, reads, ready, dispose }
}
it('公开深链在挂载前读取选中作品，水合复用相同 payload 不重复请求', async () => {
  const first = await setup('/prompts?prompt=7')
  expect(first.reads).toEqual([{ id: 7, mounted: false }])
  const payload = JSON.parse(JSON.stringify(first.app.payload.data[PROMPT_DETAIL_DATA_KEY]))
  first.dispose()
  mocks.detail.mockClear()
  const hydrated = await setup('/prompts?prompt=7', payload)
  expect(hydrated.state.selectedItem.value?.id).toBe(7)
  expect(mocks.detail).not.toHaveBeenCalled()
})
it('水合前历史导航换了目标，挂载后读取新目标且不展示旧 payload', async () => {
  const first = await setup('/prompts?prompt=7')
  const payload = JSON.parse(JSON.stringify(first.app.payload.data[PROMPT_DETAIL_DATA_KEY]))
  first.dispose()
  mocks.detail.mockClear()
  const hydrated = await setup('/prompts?prompt=8', payload)
  await vi.waitFor(() => expect(hydrated.state.selectedItem.value?.id).toBe(8))
  expect(hydrated.reads).toEqual([{ id: 8, mounted: true }])
})
it('草稿只在已挂载且已登录的客户端读取，公开 payload 不包含私人正文', async () => {
  mocks.auth.currentUser.value = { id: 'owner' }
  mocks.auth.isLoggedIn.value = true
  const value = await setup('/prompts?view=drafts&prompt=7')
  expect(mocks.detail).not.toHaveBeenCalled()
  expect(mocks.adminDetail).toHaveBeenCalledOnce()
  expect(value.state.selectedDraft.value).toBe(true)
  expect(value.state.selectedItem.value?.title).toBe('私有草稿')
  expect(JSON.stringify(value.app.payload.data[PROMPT_DETAIL_DATA_KEY])).not.toContain('私有草稿')
})
it.each(['/prompts?view=drafts&prompt=7', '/prompts?edit=7&prompt=7'])(
  '未登录访问 %s 不尝试公开或管理详情',
  async (path) => {
    const value = await setup(path)
    expect(mocks.detail).not.toHaveBeenCalled()
    expect(mocks.adminDetail).not.toHaveBeenCalled()
    expect(value.state.selectedItem.value).toBeNull()
  },
)
it('公开详情快速切换时立即撤销旧请求，迟到的成功响应不能覆盖新目标', async () => {
  const value = await setup('/prompts?prompt=7')
  const old = deferred<ImagePrompt>()
  mocks.detail.mockImplementation((id: number) => (id === 8 ? old.promise : Promise.resolve(item(id))))
  await value.router.replace('/prompts?prompt=8')
  await vi.waitFor(() => expect(mocks.detail).toHaveBeenCalledWith(8, expect.any(AbortSignal)))
  const signal = mocks.detail.mock.calls.find((call) => call[0] === 8)![1] as AbortSignal
  expect(value.state.selectedItem.value).toBeNull()
  await value.router.replace('/prompts?prompt=9')
  await vi.waitFor(() => expect(value.state.selectedItem.value?.id).toBe(9))
  expect(signal.aborted).toBe(true)
  old.resolve(item(8, '迟到的旧画面'))
  await flushPromises()
  expect(value.state.selectedItem.value?.id).toBe(9)
  expect(value.state.detailError.value).toBe('')
})
it.each(['actor', 'context'])('私有读取期间 %s 改变后，旧响应不能覆盖当前身份与恢复代次', async (change) => {
  mocks.auth.currentUser.value = { id: 'owner-a' }
  mocks.auth.isLoggedIn.value = true
  const value = await setup('/prompts?view=drafts&prompt=7')
  const old = deferred<ManagedPrompt>()
  mocks.adminDetail.mockReturnValueOnce(old.promise)
  const loading = value.state.readDetail()
  mocks.adminDetail.mockResolvedValue(draft('当前可读草稿'))
  if (change === 'actor') mocks.auth.currentUser.value = { id: 'owner-b' }
  else value.context.value = 'restored-context'
  expect(value.state.selectedItem.value).toBeNull()
  await vi.waitFor(() => expect(value.state.selectedItem.value?.title).toBe('当前可读草稿'))
  old.resolve(draft('旧身份的草稿'))
  await loading
  expect(value.state.selectedItem.value?.title).toBe('当前可读草稿')
})
it('退出登录同步移除私有详情，迟到响应不会公开草稿或回退公开 API', async () => {
  mocks.auth.currentUser.value = { id: 'owner' }
  mocks.auth.isLoggedIn.value = true
  const value = await setup('/prompts?view=drafts&prompt=7')
  const old = deferred<ManagedPrompt>()
  mocks.adminDetail.mockReturnValueOnce(old.promise)
  const loading = value.state.readDetail()
  mocks.auth.isLoggedIn.value = false
  mocks.auth.currentUser.value = null
  expect(value.state.selectedItem.value).toBeNull()
  old.resolve(draft())
  await loading
  expect(value.state.selectedItem.value).toBeNull()
  expect(mocks.detail).not.toHaveBeenCalled()
})
it('失败 payload 保留真实缺失反馈，挂载不重试；显式重试可恢复同一目标', async () => {
  mocks.detail.mockRejectedValue(new Error('这份提示词不存在或尚未公开。'))
  const first = await setup('/prompts?prompt=7')
  const payload = JSON.parse(JSON.stringify(first.app.payload.data[PROMPT_DETAIL_DATA_KEY]))
  first.dispose()
  mocks.detail.mockClear()
  const hydrated = await setup('/prompts?prompt=7', payload)
  expect(mocks.detail).not.toHaveBeenCalled()
  expect(hydrated.state.detailError.value).toContain('不存在')
  mocks.detail.mockResolvedValue(item())
  await hydrated.state.readDetail()
  expect(hydrated.state.selectedItem.value?.id).toBe(7)
  expect(hydrated.state.detailError.value).toBe('')
})

it.each(['actor', 'context'])('公开读取期间 %s 变化也取消旧所有权，迟到结果不回滚元信息', async (change) => {
  const value = await setup('/prompts?prompt=7')
  const old = deferred<ImagePrompt>()
  const before = mocks.detail.mock.calls.length
  mocks.detail.mockReturnValueOnce(old.promise)
  const loading = value.state.readDetail()
  await vi.waitFor(() => expect(mocks.detail).toHaveBeenCalledTimes(before + 1))
  const signal = mocks.detail.mock.calls.at(-1)![1] as AbortSignal
  mocks.detail.mockResolvedValue(item(7, '当前代次的公开画面'))
  if (change === 'actor') mocks.auth.currentUser.value = { id: 'new-owner' }
  else value.context.value = 'restored-context'
  expect(value.state.selectedItem.value).toBeNull()
  await vi.waitFor(() => expect(value.state.selectedItem.value?.title).toBe('当前代次的公开画面'))
  expect(signal.aborted).toBe(true)
  old.resolve(item(7, '过期画面'))
  await loading
  expect(value.state.selectedItem.value?.title).toBe('当前代次的公开画面')
})
it('离开详情后迟到结果不能重新打开目标，重新进入会读取当前公开版本', async () => {
  const value = await setup('/prompts?prompt=7')
  const old = deferred<ImagePrompt>()
  mocks.detail.mockReturnValueOnce(old.promise)
  await value.router.replace('/prompts?prompt=8')
  await vi.waitFor(() => expect(mocks.detail).toHaveBeenCalledWith(8, expect.any(AbortSignal)))
  await value.router.replace('/prompts')
  old.resolve(item(8, '已经关闭的详情'))
  await flushPromises()
  expect(value.state.selectedId.value).toBeNull()
  expect(value.state.selectedItem.value).toBeNull()
  expect(value.state.detailError.value).toBe('')
  expect(value.state.detailPending.value).toBe(false)
  mocks.detail.mockResolvedValue(item(8, '重新读取的详情'))
  await value.router.replace('/prompts?prompt=8')
  await vi.waitFor(() => expect(value.state.selectedItem.value?.title).toBe('重新读取的详情'))
})
