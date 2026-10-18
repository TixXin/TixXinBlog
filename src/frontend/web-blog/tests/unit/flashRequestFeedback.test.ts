/** @file flashRequestFeedback.test.ts @description 闪念概览和详情读取失败的独立重试、在途防重与真实内容恢复。 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import FlashPage from '../../app/pages/flash/index.vue'
import FlashDetailPage from '../../app/pages/flash/[id].vue'
import RequestFeedback from '../../app/components/common/RequestFeedback.vue'
import type { FlashNote } from '../../app/features/flash/types'

const mocks = vi.hoisted(() => ({ notes: vi.fn(), load: vi.fn(), loadOverview: vi.fn(), fetchOwnerNotes: vi.fn() }))
mockNuxtImport('useFlashNotes', () => () => mocks.notes())
mockNuxtImport('useCurrentUser', () => () => ({ isLoggedIn: ref(false), currentUser: ref(null) }))
mockNuxtImport('useToast', () => () => ({ success: vi.fn(), error: vi.fn() }))
mockNuxtImport('usePageSeo', () => () => {})
mockNuxtImport('useJsonLd', () => () => {})
mockNuxtImport('useSiteSettings', () => () => ({ settings: ref({ name: '个人博客', ownerName: '博主' }) }))

const note: FlashNote = {
  id: 'public-note',
  userId: 'owner',
  content: '雨后散步记下的灵感',
  tags: ['日常'],
  images: [],
  type: 'memo',
  likes: 0,
  comments: [],
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
}
const Frame = defineComponent({
  setup:
    (_props, { slots }) =>
    () =>
      h('main', [slots.header?.(), slots.default?.(), slots.overlays?.()]),
})
const Container = defineComponent({
  setup:
    (_props, { slots }) =>
    () =>
      h('div', slots.default?.()),
})
const stubs = {
  CommonPageFrame: Frame,
  CommonCustomScrollbar: Container,
  CommonRequestFeedback: RequestFeedback,
  Teleport: true,
  SidebarRightSidebar: Container,
  SidebarFlashCalendarCard: true,
  SidebarFlashTimeCapsuleCard: true,
  FlashNoteList: true,
  FlashNoteCard: true,
  FlashAISearchModal: true,
  CommonGuestIdentityModal: true,
  Icon: true,
}
let overviewError = ref<string | null>(null)
let overviewLoading = ref(false)
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  vi.resetAllMocks()
  clearNuxtData(['flash-public-first-page', 'flash-public-public-note'])
  useRuntimeConfig().public.useMockRepo = true
  overviewError = ref(null)
  overviewLoading = ref(false)
  mocks.load.mockResolvedValue(undefined)
  mocks.loadOverview.mockResolvedValue(undefined)
  mocks.fetchOwnerNotes.mockResolvedValue([note])
  mocks.notes.mockReturnValue({
    notes: ref([note]),
    error: ref(null),
    loading: ref(false),
    loaded: ref(true),
    ownerKey: ref('public'),
    isReadOnly: ref(true),
    pagedPublic: ref(true),
    total: ref(1),
    hasMore: ref(false),
    moreLoading: ref(false),
    moreError: ref(null),
    overview: ref(null),
    overviewError,
    overviewLoading,
    aggregatesReady: ref(false),
    totalCount: ref(1),
    tagCloud: ref([]),
    monthlyCount: ref(0),
    load: mocks.load,
    loadOverview: mocks.loadOverview,
    fetchOwnerNotes: mocks.fetchOwnerNotes,
  })
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

it('概览单独失败可强制重试，不刷新成功列表或显示假零统计', async () => {
  overviewError.value = '概览服务不可用'
  const wrapper = await mountSuspended(FlashPage, { route: '/flash', global: { stubs } })
  wrappers.push(wrapper)
  const listReads = mocks.load.mock.calls.length
  mocks.loadOverview.mockClear()
  let finish!: () => void
  mocks.loadOverview.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        overviewLoading.value = true
        overviewError.value = null
        finish = () => {
          overviewLoading.value = false
          resolve()
        }
      }),
  )
  const feedback = wrapper.getComponent(RequestFeedback)
  expect(feedback.get('[role="alert"]').text()).toContain('闪念概览加载失败')
  expect(wrapper.get('.flash-stat-card').text()).toContain('—')
  expect(wrapper.getComponent({ name: 'FlashNoteList' }).props('notes')).toEqual([note])
  await feedback.get('button').trigger('click')
  expect(mocks.loadOverview).toHaveBeenCalledExactlyOnceWith(true)
  expect(feedback.get('button').attributes('aria-disabled')).toBe('true')
  await feedback.get('button').trigger('click')
  expect(mocks.loadOverview).toHaveBeenCalledOnce()
  finish()
  await flushPromises()
  expect(wrapper.findComponent(RequestFeedback).exists()).toBe(false)
  expect(mocks.load).toHaveBeenCalledTimes(listReads)
  expect(wrapper.getComponent({ name: 'FlashNoteList' }).props('notes')).toEqual([note])
})

it('本机详情读取失败通过统一反馈重试，在途防重并恢复原条目', async () => {
  mocks.fetchOwnerNotes.mockRejectedValueOnce(new Error('闪念存储暂时不可用'))
  const wrapper = await mountSuspended(FlashDetailPage, { route: '/flash/public-note', global: { stubs } })
  wrappers.push(wrapper)
  const feedback = wrapper.getComponent(RequestFeedback)
  expect(feedback.get('[role="alert"]').text()).toContain('闪念加载失败')
  let finish!: (notes: FlashNote[]) => void
  mocks.fetchOwnerNotes.mockImplementationOnce(
    () =>
      new Promise<FlashNote[]>((resolve) => {
        finish = resolve
      }),
  )
  await feedback.get('button').trigger('click')
  expect(feedback.get('button').attributes('aria-disabled')).toBe('true')
  await feedback.get('button').trigger('click')
  expect(mocks.fetchOwnerNotes).toHaveBeenCalledTimes(2)
  finish([note])
  await flushPromises()
  expect(wrapper.findComponent(RequestFeedback).exists()).toBe(false)
  expect(wrapper.getComponent({ name: 'FlashNoteCard' }).props('note')).toEqual(note)
})
