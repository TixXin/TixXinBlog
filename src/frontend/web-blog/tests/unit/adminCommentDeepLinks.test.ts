/** @file adminCommentDeepLinks.test.ts @description 评论入口直达目标页，保留未发送回复且迟到定位不能跨上下文。 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useAdminMoments } from '../../app/composables/useAdminMoments'
import { useAdminFlashes } from '../../app/composables/useAdminFlashes'

const mocks = vi.hoisted(() => ({
  auth: {} as {
    currentUser: Ref<{ id: string } | null>
    isLoggedIn: Ref<boolean>
    restoringPending: Ref<boolean>
    restore: ReturnType<typeof vi.fn>
  },
  route: {} as { path: string; fullPath: string; query: Record<string, string> },
  api: vi.fn(),
  adminList: vi.fn(),
  adminDetail: vi.fn(),
  adminComments: vi.fn(),
  adminCommentLocation: vi.fn(),
}))
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
mockNuxtImport('useRoute', () => () => mocks.route)
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useMomentRepository', () => () => mocks)
mockNuxtImport('useToast', () => () => ({ success: vi.fn(), error: vi.fn() }))
mockNuxtImport('onBeforeRouteLeave', () => () => undefined)
mockNuxtImport('onBeforeRouteUpdate', () => () => undefined)
const wrappers: { unmount(): void }[] = []
const note = { id: 'moment-a', content: '动态正文', status: 'published', revision: 1 }
function route(domain: 'moments' | 'flashes', comments: string, commentId: string) {
  Object.assign(mocks.route, {
    path: '/admin/' + domain,
    fullPath: `/admin/${domain}?comments=${comments}&commentId=${commentId}`,
    query: { comments, commentId },
  })
}
beforeEach(() => {
  mocks.auth = {
    currentUser: ref({ id: 'owner-a' }),
    isLoggedIn: ref(true),
    restoringPending: ref(false),
    restore: vi.fn().mockResolvedValue(true),
  }
  mocks.route = reactive({ path: '', fullPath: '', query: {} })
  route('moments', 'moment-a', 'target')
  mocks.adminList.mockReset().mockResolvedValue({ items: [], total: 0, page: 1 })
  mocks.adminDetail.mockReset().mockResolvedValue(note)
  mocks.adminCommentLocation.mockReset().mockResolvedValue({ page: 3, pageSize: 15, commentId: 'target' })
  mocks.adminComments
    .mockReset()
    .mockResolvedValue({ items: [{ id: 'target', content: '位于第三页的评论' }], total: 31, page: 3 })
  mocks.api
    .mockReset()
    .mockImplementation(async (path) =>
      path === '/admin/flashes'
        ? { items: [], total: 0 }
        : { id: 'flash-a', content: '闪念正文', comments: [{ id: 'target', content: '目标评论' }] },
    )
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
async function setup<T>(factory: () => T) {
  let state!: T
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          state = factory()
          return () => h('div')
        },
      }),
    ),
  )
  await flushPromises()
  return state
}

it('目标动态不在当前列表也能直接打开评论第三页，不扫描其他页', async () => {
  const state = await setup(useAdminMoments)
  expect(mocks.adminDetail).toHaveBeenCalledWith('moment-a')
  expect(mocks.adminCommentLocation).toHaveBeenCalledWith('moment-a', 'target')
  expect(mocks.adminComments).toHaveBeenCalledTimes(1)
  expect(mocks.adminComments).toHaveBeenCalledWith('moment-a', 3)
  expect(state.commentPage.value).toBe(3)
  expect(state.commentTargetId.value).toBe('target')
  expect(state.commentsLinkError.value).toBe('')
})
it('不存在的动态评论明确反馈，不展示其他评论作为目标', async () => {
  mocks.adminCommentLocation.mockRejectedValue(new Error('评论不存在或已删除'))
  const state = await setup(useAdminMoments)
  expect(state.commentsLinkError.value).toContain('不存在')
  expect(state.commentsLinkPending.value).toBe(false)
  expect(mocks.adminComments).not.toHaveBeenCalled()
})
it('快速换深链后旧页码回包不能加载旧目标页', async () => {
  let finish!: (value: unknown) => void
  mocks.adminCommentLocation.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const state = await setup(useAdminMoments)
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  mocks.adminComments.mockResolvedValue({ items: [{ id: 'new-target' }], total: 31, page: 3 })
  route('moments', 'moment-a', 'new-target')
  await flushPromises()
  finish({ page: 1, pageSize: 15, commentId: 'target' })
  await flushPromises()
  expect(state.commentTargetId.value).toBe('new-target')
  expect(mocks.adminComments).toHaveBeenCalledTimes(1)
})
it('拒绝放弃已有回复时保留原面板与输入', async () => {
  const state = await setup(useAdminMoments)
  state.commentNote.value = { ...state.commentNote.value!, id: 'other-moment' }
  state.replyDraft.value = '仍需补充的回复'
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
  await state.openLinkedComments()
  expect(state.commentNote.value?.id).toBe('other-moment')
  expect(state.replyDraft.value).toBe('仍需补充的回复')
  expect(state.commentsLinkError.value).toContain('保留')
})
it('闪念 comments 深链打开评论面板并保留 edit 入口的独立职责', async () => {
  route('flashes', 'flash-a', 'target')
  const state = await setup(useAdminFlashes)
  expect(state.commentNote.value?.id).toBe('flash-a')
  expect(state.commentTargetId.value).toBe('target')
  expect(state.commentTargetMessage.value).toBe('')
  expect(state.editorOpen.value).toBe(false)
})
it('闪念目标评论已删除时显示真实缺失状态', async () => {
  route('flashes', 'flash-a', 'missing')
  const state = await setup(useAdminFlashes)
  expect(state.commentNote.value?.id).toBe('flash-a')
  expect(state.commentTargetMessage.value).toContain('不存在或已删除')
})
it('闪念评论读取期间换账号不会应用旧账号响应', async () => {
  route('flashes', 'flash-a', 'target')
  let finish!: (value: unknown) => void
  mocks.api.mockImplementation((path) =>
    path === '/admin/flashes'
      ? Promise.resolve({ items: [], total: 0 })
      : new Promise((resolve) => {
          finish = resolve
        }),
  )
  const state = await setup(useAdminFlashes)
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  mocks.auth.currentUser.value = { id: 'owner-b' }
  finish({ id: 'flash-a', content: '旧私有正文', comments: [] })
  await flushPromises()
  expect(state.commentNote.value).toBeNull()
  expect(state.working.value).toBe(false)
})
