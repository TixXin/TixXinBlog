/** @file guestbookInteractions.test.ts @description 留言未知结果、身份切换与恢复副本保护，覆盖迟到写入和页面卸载 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useGuestbookInteractions } from '~/composables/useGuestbookInteractions'
import type { CurrentUser } from '~/features/auth/types'
import type { GuestbookRecord } from '~/features/guestbook/types'
interface AuthMock {
  currentUser: Ref<CurrentUser | null>
  initialized: Ref<boolean>
  restoringPending: Ref<boolean>
  authError: Ref<string>
  isLoggedIn: ComputedRef<boolean>
  restore: () => Promise<void>
}
const mocks = vi.hoisted(() => ({
  auth: undefined as unknown as AuthMock,
  create: vi.fn(),
  react: vi.fn(),
  detail: vi.fn(),
  invalidate: vi.fn(),
  patch: vi.fn(),
  onSent: vi.fn(),
}))
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
mockNuxtImport('useGuestbookRepository', () => () => mocks)
mockNuxtImport('useGuestbookCache', () => () => ({ ...mocks, generation: ref(0) }))
mockNuxtImport('useGuestIdentity', () => () => ({
  hasIdentity: ref(true),
  guestIdentity: ref({ nickname: '小林' }),
  resolveAvatar: () => '/avatar.svg',
}))
mockNuxtImport('useLoginDrawer', () => () => ({ open: vi.fn() }))
const wrappers: { unmount(): void }[] = []
const owner = (id = 'owner-a'): CurrentUser => ({
  id,
  nickname: '博主',
  email: '',
  avatar: '/avatar.svg',
  role: 'owner',
})
const record = (): GuestbookRecord => ({
  id: 10,
  author: '博主',
  avatar: '',
  content: '已发送内容',
  isOwner: true,
  isPinned: false,
  createdAt: new Date().toISOString(),
  moderationStatus: 'published',
  reactions: [],
  replyTo: null,
  replyUnavailable: false,
})
beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  const currentUser = ref<CurrentUser | null>(owner())
  mocks.auth = {
    currentUser,
    initialized: ref(true),
    restoringPending: ref(false),
    authError: ref(''),
    isLoggedIn: computed(() => !!currentUser.value),
    restore: async () => {},
  }
  mocks.create.mockReset().mockResolvedValue(record())
  mocks.detail.mockReset()
  mocks.onSent.mockReset().mockResolvedValue(undefined)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})
async function setup(scope = crypto.randomUUID()) {
  let interactions!: ReturnType<typeof useGuestbookInteractions>
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        interactions = useGuestbookInteractions(mocks.onSent, scope)
        return () => h('div')
      },
    }),
  )
  wrappers.push(wrapper)
  await flushPromises()
  return { interactions, wrapper, scope }
}
it('未知发送失败保留输入和同一提交标识，确认后才清空', async () => {
  const { interactions: flow } = await setup()
  flow.setDraft('正文')
  mocks.create.mockRejectedValueOnce(new Error('响应丢失'))
  await flow.submit()
  expect(flow.state.draft).toBe('正文')
  expect(flow.state.error).toBe('响应丢失')
  const first = mocks.create.mock.calls[0]![0]
  await flow.submit()
  expect(mocks.create.mock.calls[1]![0]).toEqual(first)
  expect(flow.state.draft).toBe('')
  expect(flow.state.error).toBe('')
})
it('发送中不重复写入，迟到成功不清除新输入，列表失败仍保持发送成功', async () => {
  const { interactions: flow } = await setup()
  let finish!: (value: GuestbookRecord) => void
  mocks.create.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  flow.setDraft('第一条')
  const sending = flow.submit()
  await flow.submit()
  expect(mocks.create).toHaveBeenCalledTimes(1)
  flow.setDraft('下一条仍在编写')
  mocks.onSent.mockRejectedValueOnce(new Error('列表失败'))
  finish(record())
  await sending
  expect(flow.state.draft).toBe('下一条仍在编写')
  expect(flow.state.error).toBe('')
  expect(flow.state.notice).toContain('留言已发送')
  expect(flow.state.notice).toContain('列表暂未更新')
})
it('首次恢复身份期间开始输入，身份确认后仍保留', async () => {
  let finish!: () => void
  mocks.auth.currentUser.value = null
  mocks.auth.initialized.value = false
  mocks.auth.restoringPending.value = true
  mocks.auth.restore = () =>
    new Promise((resolve) => {
      finish = resolve
    })
  const { interactions: flow } = await setup()
  flow.setDraft('先写一点')
  expect(flow.ready.value).toBe(false)
  mocks.auth.currentUser.value = owner()
  mocks.auth.initialized.value = true
  mocks.auth.restoringPending.value = false
  finish()
  await flushPromises()
  expect(flow.ready.value).toBe(true)
  expect(flow.state.draft).toBe('先写一点')
})
it('过期锁住原博主草稿，同账号恢复保留，换账号隔离', async () => {
  const { interactions: flow, scope } = await setup()
  flow.setDraft('账号A的私人草稿')
  mocks.auth.currentUser.value = null
  mocks.auth.authError.value = '会话已失效'
  await flushPromises()
  expect(flow.expired.value).toBe(true)
  expect(flow.state.draft).toBe('账号A的私人草稿')
  await flow.submit()
  expect(mocks.create).not.toHaveBeenCalled()
  mocks.auth.currentUser.value = owner()
  mocks.auth.authError.value = ''
  await flushPromises()
  expect(flow.ready.value).toBe(true)
  expect(flow.state.draft).toBe('账号A的私人草稿')
  mocks.auth.currentUser.value = owner('owner-b')
  await flushPromises()
  expect(flow.state.draft).toBe('')
  expect(flow.state.actor).toBe('admin:owner-b')
  expect(sessionStorage.getItem(`tixxin-guestbook-draft:${scope}:admin:owner-a`)).toContain('账号A的私人草稿')
})
it('换账号后旧请求成功不清空或污染当前账号输入', async () => {
  const { interactions: flow } = await setup()
  let finish!: (value: GuestbookRecord) => void
  mocks.create.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  flow.setDraft('账号A发送')
  const sending = flow.submit()
  mocks.auth.currentUser.value = owner('owner-b')
  await flushPromises()
  flow.setDraft('账号B输入')
  finish(record())
  await sending
  expect(flow.state.draft).toBe('账号B输入')
  expect(flow.state.notice).toBe('')
  expect(flow.state.submitting).toBe(false)
  expect(mocks.onSent).not.toHaveBeenCalled()
})
it('恢复未知结果时保留提交标识，不因引用暂不可见生成重复请求', async () => {
  const scope = crypto.randomUUID(),
    nonce = crypto.randomUUID()
  const signature = JSON.stringify({ actor: 'admin:owner-a', content: '待确认的回复', replyToId: 42 })
  sessionStorage.setItem(
    `tixxin-guestbook-draft:${scope}:admin:owner-a`,
    JSON.stringify({ content: '待确认的回复', replyId: 42, nonce, signature }),
  )
  const { interactions: flow } = await setup(scope)
  expect(flow.state.draft).toBe('')
  expect(flow.state.recovery?.nonce).toBe(nonce)
  mocks.detail.mockRejectedValueOnce(new Error('已隐藏'))
  await flow.restore()
  expect(flow.state.reply?.id).toBe(42)
  await flow.submit()
  expect(mocks.create.mock.calls[0]![0]).toMatchObject({ requestId: nonce, content: '待确认的回复', replyToId: 42 })
})
it('身份恢复尚未结束就卸载时，不安装遗留的页面退出监听', async () => {
  let finish!: () => void
  mocks.auth.restore = () =>
    new Promise((resolve) => {
      finish = resolve
    })
  const listener = vi.spyOn(window, 'addEventListener')
  const { wrapper } = await setup()
  wrapper.unmount()
  finish()
  await flushPromises()
  expect(listener.mock.calls.some((call) => call[0] === 'beforeunload')).toBe(false)
})
