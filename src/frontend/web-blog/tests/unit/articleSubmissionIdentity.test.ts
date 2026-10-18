/** @file articleSubmissionIdentity.test.ts @description 文章首次访客身份确认保留原表单字段，个人网站不混入蜜罐 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { Ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useArticleComments } from '~/composables/useArticleComments'
import { createCommentController } from '~/features/post/commentController'
const mocks = vi.hoisted(() => ({
  identity: undefined as unknown as Ref<{ nickname: string; website?: string } | null>,
  controller: undefined as unknown as ReturnType<typeof createCommentController>,
  create: vi.fn(),
}))
vi.mock('~/features/post/commentSession', () => ({
  getCommentSession: () => mocks.controller,
  rememberCommentSession: () => mocks.controller,
}))
mockNuxtImport('useGuestIdentity', () => () => ({ guestIdentity: mocks.identity, resolveAvatar: () => '' }))
mockNuxtImport('useToast', () => () => ({ success: vi.fn() }))
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  mocks.identity = ref(null)
  mocks.create
    .mockReset()
    .mockResolvedValue({ id: 1, author: '访客', content: '正文', time: '2026-10-18', likes: 0, avatar: '' })
  mocks.controller = createCommentController(
    {
      load: async () => ({ items: [], total: 0 }),
      create: mocks.create,
      like: async () => ({ liked: false, likes: 0 }),
    },
    { items: [], total: 0 },
  )
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
it('打开身份面板后无参数确认沿用原字段，不发送访客个人网站或其他身份字段', async () => {
  let flow!: Awaited<ReturnType<typeof useArticleComments>>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        async setup() {
          flow = await useArticleComments('1')
          return () => h('div')
        },
      }),
    ),
  )
  flow.draft.value = '保留的评论'
  await flow.submit({ website: '', formRenderedAt: 1000 })
  expect(flow.identityVisible.value).toBe(true)
  expect(mocks.create).not.toHaveBeenCalled()
  mocks.identity.value = { nickname: '访客', website: 'https://personal.example' }
  await flow.submit()
  expect(mocks.create).toHaveBeenCalledWith({
    author: '访客',
    avatar: undefined,
    content: '保留的评论',
    website: '',
    formRenderedAt: 1000,
  })
  expect(flow.draft.value).toBe('')
})
