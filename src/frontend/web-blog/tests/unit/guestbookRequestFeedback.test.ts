/** @file guestbookRequestFeedback.test.ts @description 留言两种布局的历史读取失败保留内容，统一反馈重试并阻止忙碌时重复触发。 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import GuestbookPage from '../../app/pages/guestbook.vue'
import type { DateGroup } from '../../app/features/guestbook/types'

const mocks = vi.hoisted(() => ({ feed: vi.fn(), theme: vi.fn(), retryMore: vi.fn(), loadMore: vi.fn() }))
mockNuxtImport('useGuestbookFeed', () => async () => mocks.feed())
mockNuxtImport('useGuestbookMetadata', () => async () => ({ data: ref(null), pending: ref(false), error: ref(null) }))
mockNuxtImport('useLayoutTheme', () => () => mocks.theme())
mockNuxtImport('useCurrentUser', () => () => ({ isLoggedIn: ref(false) }))
mockNuxtImport('useSiteInfo', () => () => ({ ownerPresence: ref({ status: 'offline', signature: '', label: '离线' }) }))
mockNuxtImport('useSiteSettings', () => () => ({ settings: ref({ avatar: '' }) }))
mockNuxtImport('usePageSeo', () => () => {})
mockNuxtImport('useGuestbookInteractions', () => () => ({
  state: { draft: '保留输入', reply: null, submitting: false, error: '', notice: '', storageError: '', recovery: null },
  ready: ref(true),
  expired: ref(false),
  identityLabel: ref('访客'),
  reacting: ref([]),
  reactionErrors: ref({}),
  identityVisible: ref(false),
}))
vi.mock('@vueuse/core', async (original) => ({
  ...(await original<typeof import('@vueuse/core')>()),
  useMediaQuery: () => ref(true),
}))

const Frame = defineComponent({
  setup:
    (_props, { slots }) =>
    () =>
      h('main', [slots.header?.(), slots.default?.()]),
})
const Container = defineComponent({
  setup:
    (_props, { slots }) =>
    () =>
      h('div', slots.default?.()),
})
const MessageList = defineComponent({
  props: ['groups'],
  setup: (props) => () =>
    h(
      'div',
      { class: 'message-list' },
      (props.groups as DateGroup[]).flatMap((group) => group.messages.map((message) => h('p', message.content))),
    ),
})
const wrappers: { unmount(): void }[] = []
const moreError = ref('历史读取中断'),
  morePending = ref(false),
  hasMore = ref(true)
beforeEach(() => {
  vi.resetAllMocks()
  moreError.value = '历史读取中断'
  morePending.value = false
  hasMore.value = true
  mocks.feed.mockReturnValue({
    items: ref([
      {
        id: 1,
        author: '小林',
        avatar: '',
        content: '已经加载的留言',
        createdAt: '2026-10-01T10:00:00.000Z',
        isOwner: false,
        isPinned: false,
        moderationStatus: 'published',
        replyTo: null,
        replyUnavailable: false,
        reactions: [],
      },
    ]),
    pending: ref(false),
    error: ref(null),
    morePending,
    moreError,
    hasMore,
    personalized: ref(true),
    loadMore: mocks.loadMore,
    retryMore: mocks.retryMore,
    refresh: vi.fn(),
  })
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

async function setup(chat = false) {
  mocks.theme.mockReturnValue({
    activeTheme: ref({ capabilities: { leftSidebar: chat, rightSidebar: false } }),
    currentThemeId: ref(chat ? 'nexus' : 'dock'),
  })
  const wrapper = await mountSuspended(GuestbookPage, {
    route: '/guestbook',
    attachTo: document.body,
    global: {
      stubs: {
        CommonPageFrame: Frame,
        CommonCustomScrollbar: Container,
        CommonTooltip: Container,
        CommonContextDrawer: true,
        CommonSearchBox: true,
        Icon: true,
        GuestbookMessageInput: true,
        GuestbookMessageList: MessageList,
        GuestbookMessageSkeleton: true,
        GuestbookEmptyState: true,
        GuestbookPinnedMessage: true,
      },
    },
  })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

it.each([true, false])('聊天布局 %s 的历史失败统一重试，保留留言与输入', async (chat) => {
  const wrapper = await setup(chat)
  expect(wrapper.get('[data-display-mode]').attributes('data-display-mode')).toBe(chat ? 'chat' : 'forum')
  expect(wrapper.get('[role="alert"]').text()).toContain('历史留言加载失败')
  expect(wrapper.get('[role="alert"]').text()).toContain('历史读取中断')
  expect(wrapper.get('.message-list').text()).toBe('已经加载的留言')
  expect(wrapper.get('guestbook-message-input-stub').attributes('draft')).toBe('保留输入')
  await wrapper.get('.request-feedback button').trigger('click')
  expect(mocks.retryMore).toHaveBeenCalledOnce()
  expect(mocks.loadMore).not.toHaveBeenCalled()

  morePending.value = true
  await flushPromises()
  expect(wrapper.get('.request-feedback button').attributes('aria-disabled')).toBe('true')
  await wrapper.get('.request-feedback button').trigger('click')
  expect(mocks.retryMore).toHaveBeenCalledOnce()
  expect(wrapper.get('.message-list').text()).toBe('已经加载的留言')

  moreError.value = ''
  morePending.value = false
  await flushPromises()
  expect(wrapper.find('.request-feedback').exists()).toBe(false)
  expect(wrapper.get('.guestbook-more button').text()).toBe(chat ? '加载历史留言' : '加载更多留言')
})

it.each([true, false])('重试清除旧错误时保留焦点，完成后还有历史 %s 时交回可浏览位置', async (remaining) => {
  let finish!: () => void
  mocks.retryMore.mockImplementation(() => {
    moreError.value = ''
    morePending.value = true
    return new Promise<void>((resolve) => {
      finish = () => {
        morePending.value = false
        hasMore.value = remaining
        resolve()
      }
    })
  })
  const wrapper = await setup()
  const trigger = wrapper.get<HTMLButtonElement>('.request-feedback button')
  trigger.element.focus()
  await trigger.trigger('click')
  await flushPromises()
  expect(wrapper.get('.request-feedback button').element).toBe(trigger.element)
  expect(document.activeElement).toBe(trigger.element)
  expect(trigger.attributes('aria-disabled')).toBe('true')
  await trigger.trigger('click')
  expect(mocks.retryMore).toHaveBeenCalledOnce()
  finish()
  await flushPromises()
  const destination = remaining ? '.guestbook-more button' : '.guestbook-center__messages-wrap'
  expect(wrapper.find('.request-feedback').exists()).toBe(false)
  expect(document.activeElement).toBe(wrapper.get(destination).element)
})

it('等待重试期间焦点已转移到别处时不强行归还', async () => {
  let finish!: () => void
  mocks.retryMore.mockImplementation(() => {
    moreError.value = ''
    morePending.value = true
    return new Promise<void>((resolve) => {
      finish = () => {
        morePending.value = false
        resolve()
      }
    })
  })
  const wrapper = await setup()
  const trigger = wrapper.get<HTMLButtonElement>('.request-feedback button')
  trigger.element.focus()
  await trigger.trigger('click')
  const destination = wrapper.get<HTMLElement>('.guestbook-center__messages-wrap')
  destination.element.focus()
  finish()
  await flushPromises()
  expect(document.activeElement).toBe(destination.element)
})

it('首次加载更多失败后，把原按钮的键盘焦点交给重试入口', async () => {
  moreError.value = ''
  mocks.loadMore.mockImplementation(async () => {
    morePending.value = true
  })
  const wrapper = await setup()
  const trigger = wrapper.get<HTMLButtonElement>('.guestbook-more button')
  trigger.element.focus()
  await trigger.trigger('click')
  morePending.value = false
  moreError.value = '历史读取中断'
  await flushPromises()
  expect(document.activeElement).toBe(wrapper.get('.request-feedback button').element)
})
