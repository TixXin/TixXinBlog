/** @file momentSubmission.test.ts @description 朋友圈访客评论的蜜罐透传、失败草稿与业务去重边界 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useMomentInteractions } from '~/composables/useMomentInteractions'
const mocks = vi.hoisted(() => ({
  comment: vi.fn(),
  patch: vi.fn(),
  owner: false,
  identity: undefined as unknown as Ref<boolean>,
}))
mockNuxtImport('useMomentRepository', () => () => ({ comment: mocks.comment }))
mockNuxtImport('useMomentStore', () => () => ({ entries: ref({}), patch: mocks.patch }))
mockNuxtImport('useCurrentUser', () => () => ({
  initialized: ref(true),
  restoringPending: ref(false),
  isLoggedIn: ref(mocks.owner),
}))
mockNuxtImport('useGuestIdentity', () => () => ({
  hasIdentity: mocks.identity,
  guestIdentity: ref({ nickname: '访客' }),
  resolveAvatar: () => '',
}))
mockNuxtImport('useLoginDrawer', () => () => ({ open: vi.fn() }))
mockNuxtImport('useToast', () => () => ({ error: vi.fn() }))
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  mocks.owner = false
  mocks.identity = ref(true)
  mocks.comment.mockReset().mockResolvedValue({
    id: 'saved',
    author: '访客',
    avatar: '',
    content: '正文',
    time: '2026-10-18',
    commentCount: 1,
  })
  mocks.patch.mockReset()
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
async function setup() {
  let flow!: ReturnType<typeof useMomentInteractions>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          flow = useMomentInteractions()
          return () => h('div')
        },
      }),
    ),
  )
  const id = crypto.randomUUID()
  flow.seed([{ id, content: '动态', date: '2026-10-18', likes: 0, isLiked: false }])
  flow.draft({ id, value: '回复草稿' })
  return { flow, id }
}
it('拒绝后保留正文，重新渲染的计时不改变相同业务提交的 requestId', async () => {
  const { flow, id } = await setup()
  mocks.comment.mockRejectedValueOnce(new Error('提交失败，请稍后重试'))
  await flow.submit({ id, website: ' robot ', formElapsedMs: 1000 })
  const first = mocks.comment.mock.calls[0]![1]
  expect(first).toMatchObject({ website: ' robot ', formElapsedMs: 1000, content: '回复草稿' })
  expect(flow.states[id]?.draft).toBe('回复草稿')
  expect(flow.states[id]?.comments).toHaveLength(0)
  await flow.submit({ id, website: '', formElapsedMs: 3000 })
  expect(mocks.comment.mock.calls[1]![1]).toMatchObject({
    requestId: first.requestId,
    website: '',
    formElapsedMs: 3000,
  })
  expect(flow.states[id]?.draft).toBe('')
})
it('首次选择访客身份后仍用原表单字段继续提交', async () => {
  mocks.identity.value = false
  const { flow, id } = await setup()
  const submission = { id, website: ' robot ', formElapsedMs: 1000 }
  await flow.submit(submission)
  expect(mocks.comment).not.toHaveBeenCalled()
  mocks.identity.value = true
  flow.confirmIdentity()
  await flushPromises()
  expect(mocks.comment.mock.calls[0]?.[1]).toMatchObject({ website: ' robot ', formElapsedMs: 1000 })
  expect(flow.states[id]?.draft).toBe('')
})
it('博主评论不向管理写入混入防垃圾字段', async () => {
  mocks.owner = true
  const { flow, id } = await setup()
  await flow.submit({ id, website: 'robot', formElapsedMs: 1000 })
  expect(mocks.comment.mock.calls[0]?.[1]).not.toHaveProperty('website')
  expect(mocks.comment.mock.calls[0]?.[1]).not.toHaveProperty('formElapsedMs')
  expect(mocks.comment.mock.calls[0]?.[2]).toBe(true)
})
