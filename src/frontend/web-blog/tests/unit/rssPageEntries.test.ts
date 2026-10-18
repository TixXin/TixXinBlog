/** @file rssPageEntries.test.ts @description 挂载真实闪念与朋友圈页面，验证 RSS 页头入口不依赖登录态。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import FlashPage from '../../app/pages/flash/index.vue'
import MomentsPage from '../../app/pages/moments/index.vue'

const mocks = vi.hoisted(() => ({
  auth: {} as { isLoggedIn: Ref<boolean>; currentUser: Ref<{ id: string } | null> },
  flashNotes: vi.fn(),
  momentFilters: vi.fn(),
  momentOverview: vi.fn(),
  momentFeed: vi.fn(),
}))

mockNuxtImport('useCurrentUser', () => () => mocks.auth)
mockNuxtImport('useFlashNotes', () => () => mocks.flashNotes())
mockNuxtImport('useMomentFilters', () => () => mocks.momentFilters())
mockNuxtImport('useMomentOverview', () => async () => mocks.momentOverview())
mockNuxtImport('useMomentFeed', () => async () => mocks.momentFeed())
mockNuxtImport('usePageSeo', () => () => undefined)
mockNuxtImport('useGuestIdentity', () => () => ({ guestIdentity: ref(null), hasIdentity: ref(false) }))
mockNuxtImport('useLoginDrawer', () => () => ({ open: vi.fn() }))
mockNuxtImport('useToast', () => () => ({ success: vi.fn(), error: vi.fn() }))
mockNuxtImport('useMomentInteractions', () => () => ({ seed: vi.fn() }))
mockNuxtImport('useMomentSidebarPlacement', () => () => ({
  rightInfo: ref(false),
  drawerInfo: ref(false),
  drawerOpen: ref(false),
}))

// 保留真实页面的 setup 与页头插槽，列表和侧栏不属于订阅入口的验证范围。
const HeaderFrame = defineComponent({
  setup:
    (_props, { slots }) =>
    () =>
      h('main', [h('header', slots.header?.())]),
})
const wrappers: { unmount(): void }[] = []

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth = { isLoggedIn: ref(false), currentUser: ref(null) }
  mocks.flashNotes.mockReturnValue({
    error: ref(null),
    notes: ref([]),
    loading: ref(false),
    loaded: ref(true),
    ownerKey: ref('public'),
    isReadOnly: computed(() => !mocks.auth.isLoggedIn.value),
    pagedPublic: ref(true),
    total: ref(0),
    hasMore: ref(false),
    moreLoading: ref(false),
    moreError: ref(null),
    overview: ref(null),
    aggregatesReady: ref(false),
    totalCount: ref(0),
    tagCloud: ref([]),
    monthlyCount: ref(0),
    load: vi.fn().mockResolvedValue(undefined),
    loadOverview: vi.fn().mockResolvedValue(undefined),
  })
  mocks.momentFilters.mockReturnValue({
    searchKeyword: ref(''),
    selectedTopic: ref(null),
    selectedDate: ref(null),
    page: ref(1),
    setPage: vi.fn(),
    filterQuery: ref({}),
    clearFilters: vi.fn(),
  })
  mocks.momentOverview.mockReturnValue({
    metadata: ref(null),
    authorStats: ref({}),
    ownerCard: ref({ name: '博主' }),
    ownerProfile: ref({}),
    momentTopics: ref([]),
    momentDates: ref([]),
    momentDateCounts: ref({}),
    photoWallImages: ref([]),
    moments: ref([]),
    error: ref(null),
    pending: ref(false),
    refresh: vi.fn(),
  })
  mocks.momentFeed.mockReturnValue({
    moments: ref([]),
    total: ref(0),
    pending: ref(false),
    error: ref(null),
    refresh: vi.fn(),
  })
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})

describe('公开页面 RSS 入口', () => {
  it.each([
    { label: '闪念', href: '/flash.xml', route: '/flash', component: FlashPage },
    { label: '朋友圈', href: '/moments.xml', route: '/moments', component: MomentsPage },
  ])('$label 页头在游客和博主登录状态下都显示同一订阅地址', async ({ label, href, route, component }) => {
    const wrapper = await mountSuspended(component, {
      route,
      global: {
        stubs: {
          CommonPageFrame: HeaderFrame,
          BlogPostTabs: true,
          CommonSearchBox: true,
          MomentInfoDrawer: true,
        },
      },
    })
    wrappers.push(wrapper)
    const assertEntry = () => {
      const link = wrapper.get<HTMLAnchorElement>(`header .page-actions a[href="${href}"]`)
      expect(link.attributes('aria-label')).toBe(`订阅${label} RSS`)
      expect(link.attributes('type')).toBe('application/rss+xml')
      expect(link.text()).toBe('RSS')
      expect(link.element.tabIndex).toBe(0)
      expect(link.get('[class~="i-lucide:rss"]').attributes('aria-hidden')).toBe('true')
    }
    assertEntry()
    mocks.auth.currentUser.value = { id: 'owner' }
    mocks.auth.isLoggedIn.value = true
    await nextTick()
    assertEntry()
    mocks.auth.currentUser.value = null
    mocks.auth.isLoggedIn.value = false
    await nextTick()
    assertEntry()
    const data = route === '/flash' ? mocks.flashNotes() : mocks.momentFeed()
    data.error.value = new Error('内容暂时无法加载')
    await nextTick()
    assertEntry()
  })
})
