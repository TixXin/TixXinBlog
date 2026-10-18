/** @file momentInteractions.test.ts @description 朋友圈互动的身份门禁、幂等重试、分页竞态与输入保护 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useMomentInteractions } from '~/composables/useMomentInteractions'
import { useMomentStore } from '~/composables/useMomentStore'
import { clearMomentDrafts, invalidateMomentComments, momentSession } from '~/features/moment/session'
import type { MomentCommentItem, MomentCommentPage, MomentItem } from '~/features/moment/types'

const mocks = vi.hoisted(() => ({
  auth: {} as {
    initialized: Ref<boolean>
    restoringPending: Ref<boolean>
    isLoggedIn: Ref<boolean>
    restore: ReturnType<typeof vi.fn>
  },
  identity: {} as {
    hasIdentity: Ref<boolean>
    guestIdentity: Ref<{ nickname: string } | null>
    resolveAvatar: ReturnType<typeof vi.fn>
  },
  like: vi.fn(),
  comments: vi.fn(),
  comment: vi.fn(),
  error: vi.fn(),
  open: vi.fn(),
  refresh: vi.fn(),
}))
mockNuxtImport('useMomentRepository', () => () => mocks)
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
mockNuxtImport('useGuestIdentity', () => () => mocks.identity)
mockNuxtImport('useLoginDrawer', () => () => ({ open: mocks.open }))
mockNuxtImport('useToast', () => () => ({ error: mocks.error }))
mockNuxtImport('refreshNuxtData', () => mocks.refresh)

const wrappers: { unmount(): void }[] = []
const note: MomentItem = { id: 'moment-a', content: '傍晚散步', date: '2026-10-18', likes: 2, isLiked: false }
const comment = (id = 'comment-a', patch: Partial<MomentCommentItem> = {}): MomentCommentItem => ({
  id,
  author: '小林',
  avatar: '/avatar.svg',
  content: '沿途风景很好',
  time: '2026-10-18T08:00:00Z',
  moderationStatus: 'published',
  ...patch,
})
// 访客提交携带蜜罐与表单渲染时间，由服务端判定机器人；博主身份发送时不附带。
const renderedAt = Date.parse('2026-10-18T07:59:00Z')
const submission = { id: note.id, website: '', formElapsedMs: renderedAt }
const page = (items: MomentCommentItem[], number = 1, total = items.length): MomentCommentPage => ({
  items,
  page: number,
  pageSize: 20,
  total,
})
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth = {
    initialized: ref(true),
    restoringPending: ref(false),
    isLoggedIn: ref(false),
    restore: vi.fn().mockResolvedValue(undefined),
  }
  mocks.identity = {
    hasIdentity: ref(true),
    guestIdentity: ref({ nickname: '小林' }),
    resolveAvatar: vi.fn().mockReturnValue('/avatar.svg'),
  }
  mocks.like.mockResolvedValue({ isLiked: true, likes: 3 })
  mocks.comments.mockResolvedValue(page([comment()]))
  mocks.comment.mockResolvedValue({ ...comment(), commentCount: 1 })
  mocks.refresh.mockResolvedValue(undefined)
  clearMomentDrafts(useNuxtApp())
  const session = momentSession(useNuxtApp())
  for (const id of Object.keys(session.states)) Reflect.deleteProperty(session.states, id)
  clearNuxtState([
    'moment-public-items',
    'moment-item-versions',
    'moment-item-clock',
    'moment-collection-generation',
    'moment-personalized-items',
  ])
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  clearMomentDrafts(useNuxtApp())
  vi.restoreAllMocks()
})
async function setup() {
  let flow!: ReturnType<typeof useMomentInteractions>
  let store!: ReturnType<typeof useMomentStore>
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        store = useMomentStore()
        store.accept([{ ...note }])
        flow = useMomentInteractions()
        flow.seed([note])
        return () => h('div')
      },
    }),
  )
  wrappers.push(wrapper)
  return { flow, store, state: flow.states[note.id]!, wrapper }
}

describe('朋友圈点赞与评论读取', () => {
  it('点赞只在服务端确认后更新实体，并阻止在途重复提交', async () => {
    const result = deferred<{ isLiked: boolean; likes: number }>()
    mocks.like.mockReturnValueOnce(result.promise)
    const { flow, store, state } = await setup()
    const complete = vi.fn()
    const pending = flow.like({ id: note.id, liked: true, complete })
    await flow.like({ id: note.id, liked: true, complete })
    expect(mocks.like).toHaveBeenCalledExactlyOnceWith(note.id, true)
    expect(state.likePending).toBe(true)
    expect(store.entries.value[note.id]!.likes).toBe(2)
    result.resolve({ isLiked: true, likes: 3 })
    await pending
    expect(store.entries.value[note.id]).toMatchObject({ likes: 3, isLiked: true })
    expect(state.likePending).toBe(false)
    expect(complete).toHaveBeenCalledExactlyOnceWith(true)
    expect(mocks.refresh).toHaveBeenCalledWith('moment-overview')
  })

  it('点赞失败保留计数，显示错误并允许重试', async () => {
    mocks.like.mockRejectedValueOnce(new Error('暂时离线'))
    const { flow, state, store } = await setup()
    const complete = vi.fn()
    await flow.like({ id: note.id, liked: true, complete })
    expect(store.entries.value[note.id]).toMatchObject({ likes: 2, isLiked: false })
    expect(state.likePending).toBe(false)
    expect(complete).toHaveBeenCalledWith(false)
    expect(mocks.error).toHaveBeenCalledWith('暂时离线')
    await flow.like({ id: note.id, liked: true })
    expect(store.entries.value[note.id]!.isLiked).toBe(true)
  })

  it('评论分页按编号去重、按时间排序，失败保留已有页并能重试', async () => {
    mocks.comments.mockResolvedValueOnce(page([comment('b', { time: '2026-10-18T09:00:00Z' }), comment('a')], 1, 3))
    const { flow, state } = await setup()
    await flow.comments(note.id)
    expect(state.comments.map((item) => item.id)).toEqual(['a', 'b'])
    mocks.comments.mockRejectedValueOnce(new Error('翻页失败'))
    await flow.comments(note.id)
    expect(state.page).toBe(1)
    expect(state.comments).toHaveLength(2)
    expect(state.loadError).toBe('翻页失败')
    expect(state.loading).toBe(false)
    mocks.comments.mockResolvedValueOnce(
      page(
        [
          comment('b', { content: '已更新', time: '2026-10-18T09:00:00Z' }),
          comment('c', { time: '2026-10-18T10:00:00Z' }),
        ],
        2,
        3,
      ),
    )
    await flow.comments(note.id)
    expect(mocks.comments.mock.calls.map((call) => call[1])).toEqual([1, 2, 2])
    expect(state.comments.map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect(state.comments[1]!.content).toBe('已更新')
    expect(state).toMatchObject({ page: 2, total: 3, initialized: true, loadError: '' })
    mocks.comments.mockResolvedValueOnce(page([comment('new')]))
    await flow.comments(note.id, true)
    expect(state.comments.map((item) => item.id)).toEqual(['new'])
    expect(mocks.comments).toHaveBeenLastCalledWith(note.id, 1)
  })

  it('读取互斥且审核失效后的迟到评论不能复活', async () => {
    const result = deferred<MomentCommentPage>()
    mocks.comments.mockReturnValueOnce(result.promise)
    const { flow, state } = await setup()
    const reading = flow.comments(note.id)
    await flow.comments(note.id)
    expect(mocks.comments).toHaveBeenCalledTimes(1)
    invalidateMomentComments(useNuxtApp(), note.id)
    result.resolve(page([comment()]))
    await reading
    expect(state.comments).toEqual([])
    expect(state).toMatchObject({ loading: false, initialized: false, page: 0 })
  })

  it('身份代次改变后丢弃旧点赞和评论提交结果', async () => {
    const liked = deferred<{ isLiked: boolean; likes: number }>()
    const sent = deferred<MomentCommentItem & { commentCount: number }>()
    mocks.like.mockReturnValueOnce(liked.promise)
    mocks.comment.mockReturnValueOnce(sent.promise)
    const { flow, state, store } = await setup()
    flow.draft({ id: note.id, value: '旧身份输入' })
    const liking = flow.like({ id: note.id, liked: true })
    const sending = flow.submit(submission)
    clearMomentDrafts(useNuxtApp())
    flow.draft({ id: note.id, value: '新身份输入' })
    liked.resolve({ isLiked: true, likes: 3 })
    sent.resolve({ ...comment(), commentCount: 1 })
    await Promise.all([liking, sending])
    expect(state).toMatchObject({
      draft: '新身份输入',
      comments: [],
      submitting: false,
      likePending: false,
      notice: '',
    })
    expect(store.entries.value[note.id]).toMatchObject({ likes: 2, isLiked: false })
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})

describe('朋友圈提交与草稿', () => {
  it('身份恢复期间保留输入并禁止发送', async () => {
    mocks.auth.initialized.value = false
    mocks.auth.restoringPending.value = true
    const { flow, state } = await setup()
    flow.draft({ id: note.id, value: '先写下来' })
    await flow.submit(submission)
    expect(mocks.comment).not.toHaveBeenCalled()
    expect(mocks.auth.restore).toHaveBeenCalledOnce()
    expect(state.draft).toBe('先写下来')
    expect(state.submitError).toContain('正在确认登录状态')
  })

  it('游客补充身份后发送，待审核评论保留本机可见状态', async () => {
    mocks.identity.hasIdentity.value = false
    mocks.identity.guestIdentity.value = null
    mocks.comment.mockResolvedValueOnce({ ...comment('pending', { moderationStatus: 'pending' }), commentCount: 1 })
    const { flow, state, store } = await setup()
    flow.draft({ id: note.id, value: '  沿途风景很好  ' })
    await flow.submit(submission)
    expect(flow.identityVisible.value).toBe(true)
    expect(mocks.comment).not.toHaveBeenCalled()
    mocks.identity.hasIdentity.value = true
    mocks.identity.guestIdentity.value = { nickname: '小林' }
    flow.confirmIdentity()
    await flushPromises()
    expect(mocks.comment).toHaveBeenCalledWith(
      note.id,
      {
        content: '沿途风景很好',
        author: '小林',
        avatar: '/avatar.svg',
        requestId: expect.any(String),
        website: '',
        formElapsedMs: renderedAt,
      },
      false,
    )
    expect(flow.identityVisible.value).toBe(false)
    expect(state).toMatchObject({
      draft: '',
      total: 1,
      requestId: '',
      requestBody: '',
      notice: '评论已提交，审核通过后公开。',
    })
    expect(store.entries.value[note.id]!.comments?.[0]?.moderationStatus).toBe('pending')
  })

  it('取消身份弹窗不发送，切换登录后按博主身份继续原草稿', async () => {
    mocks.identity.hasIdentity.value = false
    const { flow, state } = await setup()
    flow.draft({ id: note.id, value: '博主回复' })
    await flow.submit(submission)
    flow.cancelIdentity()
    flow.confirmIdentity()
    expect(mocks.comment).not.toHaveBeenCalled()
    expect(state.draft).toBe('博主回复')
    await flow.submit(submission)
    flow.switchToLogin()
    expect(flow.identityVisible.value).toBe(false)
    expect(mocks.open).toHaveBeenCalledWith('login')
    mocks.auth.isLoggedIn.value = true
    await flushPromises()
    expect(mocks.comment).toHaveBeenCalledWith(note.id, { content: '博主回复', requestId: expect.any(String) }, true)
    expect(state.notice).toBe('评论已发送。')
  })

  it('未知发送结果保留提交标识，原文重试复用标识，编辑后生成新标识', async () => {
    mocks.comment.mockRejectedValueOnce(new Error('响应丢失')).mockRejectedValueOnce(new Error('仍未确认'))
    const { flow, state } = await setup()
    flow.draft({ id: note.id, value: '第一版' })
    await flow.submit(submission)
    const first = mocks.comment.mock.calls[0]![1]
    expect(first.requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(state).toMatchObject({ draft: '第一版', submitError: '响应丢失', submitting: false })
    await flow.submit(submission)
    expect(mocks.comment.mock.calls[1]![1]).toEqual(first)
    flow.draft({ id: note.id, value: '修改后的内容' })
    await flow.submit(submission)
    expect(mocks.comment.mock.calls[2]![1].requestId).not.toBe(first.requestId)
    expect(state).toMatchObject({ draft: '', submitting: false, submitError: '', requestId: '' })
  })

  it('在途提交互斥，迟到成功不会清空新输入或重复累计同一评论', async () => {
    const result = deferred<MomentCommentItem & { commentCount: number }>()
    mocks.comment.mockReturnValueOnce(result.promise)
    const { flow, state, store } = await setup()
    state.comments = [comment()]
    state.total = 1
    flow.draft({ id: note.id, value: '发送内容' })
    const sending = flow.submit(submission)
    await flow.submit(submission)
    expect(mocks.comment).toHaveBeenCalledOnce()
    flow.draft({ id: note.id, value: '下一条输入' })
    result.resolve({ ...comment(), commentCount: 1 })
    await sending
    expect(state).toMatchObject({ draft: '下一条输入', total: 1, submitting: false })
    expect(state.comments).toHaveLength(1)
    expect(store.entries.value[note.id]!.commentCount).toBe(1)
  })

  it('审核改变评论版本后提交成功触发重新读取，不直接插入旧结果', async () => {
    const result = deferred<MomentCommentItem & { commentCount: number }>()
    mocks.comment.mockReturnValueOnce(result.promise)
    mocks.comments.mockResolvedValueOnce(page([comment('current')]))
    const { flow, state } = await setup()
    flow.draft({ id: note.id, value: '提交内容' })
    const sending = flow.submit(submission)
    invalidateMomentComments(useNuxtApp(), note.id)
    result.resolve({ ...comment('old'), commentCount: 1 })
    await sending
    await flushPromises()
    expect(state.comments.map((item) => item.id)).toEqual(['current'])
    expect(state.draft).toBe('')
    expect(state.notice).toContain('评论状态已变化')
    expect(mocks.comments).toHaveBeenCalledWith(note.id, 1)
  })

  it('限制草稿长度，空白不发送；退出保护在卸载后移除', async () => {
    const { flow, state, wrapper } = await setup()
    flow.draft({ id: note.id, value: ' ' })
    await flow.submit(submission)
    expect(mocks.comment).not.toHaveBeenCalled()
    const clean = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(clean)
    expect(clean.defaultPrevented).toBe(false)
    state.submitError = '旧错误'
    state.notice = '旧提示'
    flow.draft({ id: note.id, value: '字'.repeat(1001) })
    expect(state.draft).toHaveLength(1000)
    expect(state).toMatchObject({ submitError: '', notice: '' })
    const dirty = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(dirty)
    expect(dirty.defaultPrevented).toBe(true)
    wrapper.unmount()
    wrappers.splice(wrappers.indexOf(wrapper), 1)
    const disposed = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(disposed)
    expect(disposed.defaultPrevented).toBe(false)
  })
})
