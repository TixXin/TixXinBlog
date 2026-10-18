/** @file momentRequestFeedback.test.ts @description 朋友圈真实评论重试、焦点交接及详情各读取分支的统一反馈。 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import MomentCommentSection from '../../app/components/moment/MomentCommentSection.vue'
import MomentDetailPage from '../../app/pages/moments/[id].vue'
import RequestFeedback from '../../app/components/common/RequestFeedback.vue'
import { useMomentInteractions } from '../../app/composables/useMomentInteractions'
import { useMomentDetail } from '../../app/composables/useMomentDetail'
import { momentSession } from '../../app/features/moment/session'
import type { MomentCommentPage, MomentItem } from '../../app/features/moment/types'

const mocks = vi.hoisted(() => ({
  comments: vi.fn(),
  detail: vi.fn(),
  navigation: vi.fn(),
  pageDetail: vi.fn(),
  overview: vi.fn(),
}))
mockNuxtImport('useMomentRepository', () => () => mocks)
// 页面用例走 pageDetail；未准备页面桩时回退真实组合器，才能断言导航在途状态。
mockNuxtImport('useMomentDetail', (original) => (...args) => {
  const mocked = mocks.pageDetail()
  return mocked ?? original(...args)
})
mockNuxtImport('useMomentOverview', () => () => mocks.overview())
mockNuxtImport('useCurrentUser', () => () => ({ isLoggedIn: ref(false) }))
mockNuxtImport('useToast', () => () => ({ success: vi.fn(), error: vi.fn() }))
mockNuxtImport('usePageSeo', () => () => {})
mockNuxtImport('useJsonLd', () => () => {})
mockNuxtImport('useMomentSidebarPlacement', () => () => ({
  rightInfo: ref(false),
  drawerInfo: ref(true),
  drawerOpen: ref(true),
}))

const comment = { id: 'first', author: '读者', avatar: '', content: '已经读过的评论', time: '2026-10-01' }
const note: MomentItem = {
  id: 'feedback-moment',
  content: '清晨的窗边',
  date: '2026-10-01',
  likes: 0,
  isLiked: false,
  comments: [comment],
  commentCount: 3,
}
const wrappers: { unmount(): void }[] = []
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}
beforeEach(() => {
  vi.resetAllMocks()
  clearNuxtData(['moment-detail:feedback-moment', 'moment-navigation:feedback-moment'])
  clearNuxtState(['moment-public-items', 'moment-item-versions', 'moment-item-clock', 'moment-collection-generation'])
  const session = momentSession(useNuxtApp())
  session.epoch++
  for (const key of Object.keys(session.states)) Reflect.deleteProperty(session.states, key)
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

it.each([
  { remaining: true, moveFocus: false },
  { remaining: false, moveFocus: false },
  { remaining: true, moveFocus: true },
])('真实评论请求失败后保留重试与草稿，恢复时正确交接焦点：%o', async ({ remaining, moveFocus }) => {
  const first = deferred<MomentCommentPage>()
  const retry = deferred<MomentCommentPage>()
  mocks.comments.mockReturnValueOnce(first.promise).mockReturnValueOnce(retry.promise)
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        const interactions = useMomentInteractions()
        interactions.seed([note])
        const state = interactions.states[note.id]!
        state.draft = '保留未发送的想法'
        return () =>
          h(MomentCommentSection, {
            comments: state.comments,
            draft: state.draft,
            loading: state.loading,
            loadError: state.loadError,
            hasMore: state.comments.length < state.total,
            onLoadMore: () => void interactions.comments(note.id),
          })
      },
    }),
    { attachTo: document.body, global: { stubs: { MomentUserPopover: true, Icon: true } } },
  )
  wrappers.push(wrapper)
  const original = wrapper.get<HTMLButtonElement>('.moment-comments__expand')
  original.element.focus()
  await original.trigger('click')
  expect(original.attributes('aria-disabled')).toBe('true')
  expect(document.activeElement).toBe(original.element)
  first.reject(new Error('评论读取失败'))
  await flushPromises()
  const feedback = wrapper.getComponent(RequestFeedback)
  const button = feedback.get<HTMLButtonElement>('button')
  expect(document.activeElement).toBe(button.element)
  await button.trigger('click')
  expect(feedback.props('pending')).toBe(true)
  expect(feedback.props('title')).toBe('评论读取失败')
  expect(document.activeElement).toBe(button.element)
  expect(wrapper.get('input[aria-label="动态评论内容"]').element.value).toBe('保留未发送的想法')
  expect(wrapper.text()).toContain('已经读过的评论')
  await button.trigger('click')
  expect(mocks.comments).toHaveBeenCalledTimes(2)
  if (moveFocus) wrapper.get<HTMLInputElement>('input[aria-label="动态评论内容"]').element.focus()
  retry.resolve({ items: [comment], total: remaining ? 3 : 1, page: 1, pageSize: 20 })
  await flushPromises()
  expect(wrapper.findComponent(RequestFeedback).exists()).toBe(false)
  expect(wrapper.get('input[aria-label="动态评论内容"]').element.value).toBe('保留未发送的想法')
  const target =
    moveFocus || !remaining ? wrapper.get('input[aria-label="动态评论内容"]') : wrapper.get('.moment-comments__expand')
  expect(document.activeElement).toBe(target.element)
})

it('详情组合器暴露真实导航在途状态，失败后重试可恢复导航', async () => {
  mocks.detail.mockResolvedValue(note)
  mocks.navigation.mockRejectedValueOnce(new Error('导航不可用'))
  let state!: Awaited<ReturnType<typeof useMomentDetail>>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        async setup() {
          state = await useMomentDetail(ref(note.id))
          return () => h('div')
        },
      }),
    ),
  )
  await flushPromises()
  expect(state.navigationError.value).toBeTruthy()
  const retry = deferred<{ prev: MomentItem | null; next: MomentItem | null }>()
  mocks.navigation.mockReturnValueOnce(retry.promise)
  const reading = state.refreshNavigation()
  expect(state.navigationPending.value).toBe(true)
  retry.resolve({ prev: null, next: null })
  await reading
  expect(state.navigationPending.value).toBe(false)
  expect(state.navigationError.value).toBeUndefined()
})

it('详情抽屉展示概览失败，三种重试均绑定自己的在途状态', async () => {
  const overviewPending = ref(false)
  const detailPending = ref(false)
  const navigationPending = ref(false)
  const refreshOverview = vi.fn(() => (overviewPending.value = true))
  const refreshDetail = vi.fn(() => (detailPending.value = true))
  const refreshNavigation = vi.fn(() => (navigationPending.value = true))
  mocks.overview.mockResolvedValue({
    metadata: ref(null),
    authorStats: ref({}),
    ownerCard: ref({ name: '博主' }),
    ownerProfile: ref({ name: '博主', avatar: '' }),
    momentTopics: ref([]),
    momentDates: ref([]),
    momentDateCounts: ref({}),
    error: ref(new Error('概览不可用')),
    pending: overviewPending,
    refresh: refreshOverview,
  })
  mocks.pageDetail.mockResolvedValue({
    moment: ref(note),
    pending: detailPending,
    error: ref(new Error('详情更新失败')),
    refresh: refreshDetail,
    navigation: ref(null),
    navigationPending,
    navigationError: ref(new Error('导航不可用')),
    refreshNavigation,
  })
  const frame = defineComponent({
    setup:
      (_props, { slots }) =>
      () =>
        h('main', [slots.header?.(), slots.default?.(), slots.overlays?.()]),
  })
  const wrapper = await mountSuspended(MomentDetailPage, {
    route: `/moments/${note.id}`,
    global: {
      renderStubDefaultSlot: true,
      stubs: {
        CommonPageFrame: frame,
        CommonCustomScrollbar: true,
        MomentInfoDrawer: true,
        MomentCard: true,
        MomentInteractionDialogs: true,
        SidebarRightSidebar: true,
        SidebarMomentAuthorCard: true,
        SidebarMomentCalendarCard: true,
        SidebarMomentTopicCard: true,
        Teleport: true,
        Icon: true,
      },
    },
  })
  wrappers.push(wrapper)
  const overview = wrapper.get('moment-info-drawer-stub').getComponent(RequestFeedback)
  expect(overview.props('title')).toBe('动态统计暂时不可用')
  const feedbacks = wrapper.findAllComponents(RequestFeedback)
  const detail = feedbacks.find((feedback) => feedback.props('title').startsWith('动态更新失败'))!
  const navigation = feedbacks.find((feedback) => feedback.props('title') === '动态导航暂时不可用')!
  for (const [feedback, refresh] of [
    [overview, refreshOverview],
    [detail, refreshDetail],
    [navigation, refreshNavigation],
  ] as const) {
    await feedback.get('button').trigger('click')
    await nextTick()
    expect(feedback.props('pending')).toBe(true)
    await feedback.get('button').trigger('click')
    expect(refresh).toHaveBeenCalledOnce()
  }
  expect(wrapper.getComponent({ name: 'MomentCard' }).props('moment')).toEqual(note)
})
