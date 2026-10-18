/** @file articleComments.test.ts @description 文章评论的访客身份门禁、水合恢复、会话草稿与写后缓存失效。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { Ref } from 'vue'
import type { NuxtApp } from '#app'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useArticleComments } from '../../app/composables/useArticleComments'
import type { GuestIdentity } from '../../app/composables/useGuestIdentity'
import type { CommentItem } from '../../app/features/post/types'
import type { CommentList } from '../../app/features/post/commentController'
import { publicReadCache } from '../../app/utils/publicReadCache'

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  create: vi.fn(),
  like: vi.fn(),
  storedVisitor: vi.fn(),
  success: vi.fn(),
  refresh: vi.fn(),
  avatar: vi.fn(),
  identity: {} as Ref<GuestIdentity | null>,
}))
mockNuxtImport('useGuestIdentity', () => () => ({ guestIdentity: mocks.identity, resolveAvatar: mocks.avatar }))
mockNuxtImport('useToast', () => () => ({ success: mocks.success }))
mockNuxtImport('refreshNuxtData', () => mocks.refresh)
vi.mock('../../app/features/post/api', () => ({
  fetchComments: mocks.load,
  createComment: mocks.create,
  toggleCommentLike: mocks.like,
}))
vi.mock('../../app/utils/visitorId', () => ({ hasStoredVisitorId: mocks.storedVisitor }))

function comment(id = 1, overrides: Partial<CommentItem> = {}): CommentItem {
  return {
    id,
    author: '山行客',
    avatar: '',
    content: '也想去这条小路走走',
    time: '2026-10-18',
    likes: 0,
    liked: false,
    replies: [],
    ...overrides,
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
let sequence = 0
const cleanup: (() => void)[] = []
let config: ReturnType<typeof useRuntimeConfig>
beforeEach(() => {
  // 保留 Nuxt 路由初始化所需配置，只临时覆盖文章读取开关与 API 基址。
  config = useRuntimeConfig()
  const previous = { postUseMockRepo: config.public.postUseMockRepo, apiBaseUrl: config.public.apiBaseUrl }
  cleanup.push(() => Object.assign(config.public, previous))
  config.public.postUseMockRepo = false
  config.public.apiBaseUrl = '/api/v1'
  mocks.identity = ref(null)
  mocks.avatar.mockReset().mockReturnValue('/avatar.svg')
  mocks.load.mockReset().mockImplementation(async () => ({ items: [comment()], total: 1 }))
  mocks.create.mockReset().mockImplementation(async () => comment(2))
  mocks.like.mockReset().mockResolvedValue({ liked: true, likes: 5 })
  mocks.storedVisitor.mockReset().mockReturnValue(false)
  mocks.success.mockReset()
  mocks.refresh.mockReset().mockResolvedValue(undefined)
})
afterEach(async () => {
  cleanup
    .splice(0)
    .reverse()
    .forEach((dispose) => dispose())
  await flushPromises()
})
async function setup(options: { id?: string; payload?: CommentList } = {}) {
  const id = options.id ?? String(++sequence)
  let state!: Awaited<ReturnType<typeof useArticleComments>>
  let app!: NuxtApp
  let wasHydrating = false
  let wasServerRendered: boolean | undefined
  const wrapper = await mountSuspended(
    defineComponent({
      async setup() {
        app = useNuxtApp()
        const key = `article-${id}-comments`
        clearNuxtData(key)
        wasHydrating = app.isHydrating
        wasServerRendered = app.payload.serverRendered
        app.isHydrating = !!options.payload
        if (options.payload) {
          app.payload.serverRendered = true
          app.payload.data[key] = options.payload
        }
        state = await useArticleComments(id)
        return () => h('div')
      },
    }),
  )
  app.isHydrating = wasHydrating
  app.payload.serverRendered = wasServerRendered
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    wrapper.unmount()
  }
  cleanup.push(dispose)
  await flushPromises()
  return { state, app, id, dispose }
}
function cacheEntries(app: NuxtApp) {
  const cache = publicReadCache(app)
  cache.put('posts', 'comment-posts', { total: 1 }, cache.generation('posts'), 30_000)
  cache.put('post-summary', 'comment-summary', { comments: 1 }, cache.generation('post-summary'), 30_000)
  cache.put('gallery', 'comment-gallery', { total: 2 }, cache.generation('gallery'), 30_000)
  return cache
}

describe('文章评论协调', () => {
  it('没有身份时先保留草稿并打开身份框，补充身份后提交访客昵称与头像', async () => {
    const { state, app, id } = await setup()
    const cache = cacheEntries(app)
    state.draft.value = '  这篇散步记录很有意思  '
    await state.submit()
    expect(state.identityVisible.value).toBe(true)
    expect(state.draft.value).toBe('  这篇散步记录很有意思  ')
    expect(mocks.create).not.toHaveBeenCalled()
    mocks.identity.value = { id: 'guest-7', nickname: '河畔旅人' }
    mocks.load.mockResolvedValue({ items: [comment(), comment(2)], total: 2 })
    await state.submit()
    expect(mocks.create).toHaveBeenCalledWith('/api/v1', id, {
      author: '河畔旅人',
      avatar: '/avatar.svg',
      content: '这篇散步记录很有意思',
    })
    expect(state.identityVisible.value).toBe(false)
    expect(state.draft.value).toBe('')
    expect(state.total.value).toBe(2)
    expect(mocks.success).toHaveBeenCalledWith('评论发布成功')
    expect(mocks.refresh).toHaveBeenCalledWith('post-metadata')
    expect(cache.read('comment-posts')).toBeUndefined()
    expect(cache.read('comment-summary')).toBeUndefined()
    expect(cache.read('comment-gallery')).toBeDefined()
  })

  it('空白与超长草稿不打开身份框，也不发送请求', async () => {
    const { state } = await setup()
    for (const draft of [' \n ', '字'.repeat(1001)]) {
      state.draft.value = draft
      await state.submit()
      expect(state.identityVisible.value).toBe(false)
    }
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it('发送失败保留回复目标和草稿，不撤销公开缓存或播报成功', async () => {
    mocks.identity.value = { id: 'guest-7', nickname: '河畔旅人' }
    mocks.create.mockRejectedValueOnce({ data: { message: '文章已归档，无法评论' } })
    const { state, app } = await setup()
    const cache = cacheEntries(app)
    state.reply(comment())
    state.draft.value = '还想了解路线'
    await state.submit()
    expect(state.submitError.value).toBe('文章已归档，无法评论')
    expect(state.draft.value).toBe('还想了解路线')
    expect(state.replyTarget.value?.id).toBe(1)
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
    expect(cache.read('comment-posts')).toBeDefined()
  })

  it('待审提交成功但列表同步失败，仍播报已提交并保留独立的同步错误', async () => {
    mocks.identity.value = { id: 'guest-7', nickname: '河畔旅人' }
    const { state } = await setup()
    mocks.create.mockResolvedValueOnce(comment(2, { moderationStatus: 'pending' }))
    mocks.load.mockRejectedValueOnce(new Error('读取中断'))
    state.draft.value = '等待审核的留言'
    await state.submit()
    expect(state.total.value).toBe(1)
    expect(state.comments.value.map((item) => item.id)).toEqual([1])
    expect(state.draft.value).toBe('')
    expect(state.submitError.value).toBe('')
    expect(state.loadError.value).toContain('评论已提交，等待审核')
    expect(mocks.success).toHaveBeenCalledWith('评论已提交，等待博主审核，通过后公开显示')
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })

  it('跨页面挂载复用同一文章的草稿和在途提交，避免重复发送', async () => {
    mocks.identity.value = { id: 'guest-7', nickname: '河畔旅人' }
    const first = await setup()
    first.state.draft.value = '跨主题保留的评论'
    const pending = deferred<CommentItem>()
    mocks.create.mockReturnValueOnce(pending.promise)
    const submitting = first.state.submit()
    first.dispose()
    const second = await setup({ id: first.id })
    expect(second.state.draft).toBe(first.state.draft)
    expect(second.state.submitting.value).toBe(true)
    await second.state.submit()
    expect(mocks.create).toHaveBeenCalledOnce()
    expect(mocks.load).toHaveBeenCalledOnce()
    pending.resolve(comment(2))
    await submitting
    expect(second.state.draft.value).toBe('')
    expect(second.state.submitting.value).toBe(false)
  })

  it('不同文章与 API 基址不共享评论草稿', async () => {
    const first = await setup()
    first.state.draft.value = '只属于当前文章'
    const other = await setup()
    expect(other.state.draft.value).toBe('')
    config.public.apiBaseUrl = '/next-api/v1'
    const nextBase = await setup({ id: first.id })
    expect(nextBase.state.draft.value).toBe('')
    expect(first.state.draft.value).toBe('只属于当前文章')
    expect(mocks.load).toHaveBeenCalledTimes(3)
  })

  it.each([false, true])('水合时设备已有身份为 %s，仅已有身份恢复个人点赞和待审评论', async (stored) => {
    mocks.storedVisitor.mockReturnValue(stored)
    mocks.load.mockResolvedValue({ items: [comment(1, { liked: true, likes: 4 })], total: 1 })
    const { state } = await setup({ payload: { items: [comment()], total: 1 } })
    expect(mocks.load).toHaveBeenCalledTimes(stored ? 1 : 0)
    expect(state.comments.value[0]?.liked).toBe(stored)
    expect(state.comments.value[0]?.likes).toBe(stored ? 4 : 0)
  })

  it('客户端导航首次读取已经包含个人状态，不再次整树重读', async () => {
    mocks.storedVisitor.mockReturnValue(true)
    const { state, id } = await setup()
    expect(mocks.load).toHaveBeenCalledOnce()
    expect(mocks.load).toHaveBeenCalledWith('/api/v1', id, expect.any(AbortSignal))
    expect(state.loadError.value).toBe('')
    await state.like(1)
    expect(mocks.like).toHaveBeenCalledWith('/api/v1', 1)
    expect(state.comments.value[0]).toMatchObject({ liked: true, likes: 5 })
  })

  it('首屏读取失败显示可重试错误，显式重试恢复真实评论', async () => {
    mocks.load.mockRejectedValueOnce(new Error('后端暂不可用'))
    const { state } = await setup()
    expect(state.comments.value).toEqual([])
    expect(state.loadError.value).toBe('评论加载失败，请重试')
    await state.reload()
    expect(state.loadError.value).toBe('')
    expect(state.total.value).toBe(1)
    expect(state.comments.value[0]?.content).toBe('也想去这条小路走走')
  })
})
