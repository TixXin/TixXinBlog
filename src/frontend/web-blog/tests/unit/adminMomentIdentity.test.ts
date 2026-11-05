/** @file adminMomentIdentity.test.ts @description 动态管理重新登录保留本人输入，换账号与旧响应不能混用私有草稿 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useAdminMoments } from '~/composables/useAdminMoments'
import type { ManagedMoment } from '~/features/moment/types'
const mocks = vi.hoisted(() => ({
  currentUser: null as unknown as Ref<{ id: string } | null>,
  isLoggedIn: null as unknown as Ref<boolean>,
  restoringPending: null as unknown as Ref<boolean>,
  restore: vi.fn(),
  adminList: vi.fn(),
  adminComments: vi.fn(),
  comment: vi.fn(),
  refresh: vi.fn(),
}))
mockNuxtImport('useCurrentUser', () => () => mocks)
mockNuxtImport('useMomentRepository', () => () => mocks)
mockNuxtImport('refreshNuxtData', () => mocks.refresh)
const note: ManagedMoment = {
  id: 'note',
  content: '真实动态',
  status: 'published',
  revision: 0,
  linkedArticleId: null,
  createdAt: '2026-09-09',
  updatedAt: '2026-09-09',
  date: '2026-09-09',
  likes: 0,
  isLiked: false,
}
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  mocks.currentUser = ref({ id: 'first' })
  mocks.isLoggedIn = computed(() => !!mocks.currentUser.value)
  mocks.restoringPending = ref(false)
  mocks.restore.mockImplementation(async () => mocks.isLoggedIn.value)
  mocks.adminList.mockResolvedValue({ items: [note], total: 1, page: 1, pageSize: 15 })
  mocks.adminComments.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 15 })
  mocks.refresh.mockResolvedValue(undefined)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.clearAllMocks()
})
async function setup() {
  let state!: ReturnType<typeof useAdminMoments>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          state = useAdminMoments()
          return () => h('div')
        },
      }),
    ),
  )
  await flushPromises()
  await state.openComments(note)
  return state
}
it('同一账号原地重新登录保留未发送回复', async () => {
  const state = await setup()
  state.replyDraft.value = '本人未发送内容'
  mocks.currentUser.value = null
  await flushPromises()
  mocks.currentUser.value = { id: 'first' }
  await flushPromises()
  expect(state.replyDraft.value).toBe('本人未发送内容')
})
it('换账号清理旧草稿，旧回复迟到成功不会覆盖新账号输入', async () => {
  const state = await setup()
  state.replyDraft.value = '之前的回复'
  let finish!: (value: unknown) => void
  mocks.comment.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const submitting = state.reply()
  await flushPromises()
  mocks.currentUser.value = null
  await flushPromises()
  mocks.currentUser.value = { id: 'second' }
  await flushPromises()
  expect(state.replyDraft.value).toBe('')
  expect(state.commentNote.value).toBeNull()
  state.replyDraft.value = '新账号输入'
  finish({ id: 'reply', commentCount: 1 })
  await submitting
  expect(state.replyDraft.value).toBe('新账号输入')
  expect(state.commentNote.value).toBeNull()
})
it('指定回复对象随博主回复提交，成功或关闭面板后回到直接评论，换对象视为新提交', async () => {
  const state = await setup()
  mocks.comment.mockRejectedValueOnce(new Error('网络失败'))
  state.replyDraft.value = '谢谢'
  state.startReply({ id: 'c-1', author: '远山', avatar: '', content: '晚霞', time: '' })
  await state.reply().catch(() => {})
  const first = mocks.comment.mock.calls[0]!
  expect(first[1]).toMatchObject({ content: '谢谢', replyToId: 'c-1' })
  expect(first[2]).toBe(true)
  state.startReply({ id: 'c-2', author: '读者', avatar: '', content: '同感', time: '' })
  mocks.comment.mockResolvedValueOnce({ id: 'reply', commentCount: 2 })
  await state.reply()
  const second = mocks.comment.mock.calls[1]![1]
  expect(second).toMatchObject({ replyToId: 'c-2' })
  expect(second.requestId).not.toBe(first[1].requestId)
  expect(state.replyTarget.value).toBeNull()
  state.startReply({ id: 'c-1', author: '远山', avatar: '', content: '晚霞', time: '' })
  state.closeComments()
  expect(state.replyTarget.value).toBeNull()
})
