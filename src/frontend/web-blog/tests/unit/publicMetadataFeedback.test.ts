/** @file publicMetadataFeedback.test.ts @description 归档与 Nexus 统计的首次失败及旧数据刷新失败都有独立重试入口。 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import NexusLayout from '../../themes/nexus/app/components/RootLayout.vue'
import ArchivePage from '../../app/pages/archive.vue'
import RequestFeedback from '../../app/components/common/RequestFeedback.vue'

const mocks = vi.hoisted(() => ({ summary: {} as Record<string, unknown>, archive: {} as Record<string, unknown> }))
mockNuxtImport('usePostMetadata', () => async () => mocks.summary)
mockNuxtImport('usePostArchive', () => async () => mocks.archive)
mockNuxtImport('useMomentOverview', () => async () => ({}))
const wrappers: { unmount(): void }[] = []
const Frame = defineComponent({
  setup:
    (_props, { slots }) =>
    () =>
      h('main', [slots.header?.(), slots.default?.(), slots.overlays?.()]),
})
beforeEach(() => {
  mocks.summary = {
    metadata: ref({ stats: { posts: 1 } }),
    siteStats: ref({ articles: 1 }),
    archiveStats: ref([]),
    categoryDistribution: ref([]),
    error: ref(new Error('offline')),
    pending: ref(false),
    refresh: vi.fn(),
  }
  mocks.archive = {
    query: ref({ page: 1 }),
    ready: ref(true),
    current: ref(null),
    displayed: ref(null),
    years: ref([]),
    archiveYears: ref([]),
    error: ref(null),
    pending: ref(false),
  }
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

it.each([
  { name: '归档', component: ArchivePage, card: 'article-archive-stats-stub', title: '归档统计暂时不可用' },
  { name: 'Nexus', component: NexusLayout, card: 'sidebar-site-stats-card-stub', title: '站点统计暂时不可用' },
])('$name 旧统计仍显示时不能掩盖刷新失败', async ({ component, card, title }) => {
  const wrapper = await mountSuspended(component, {
    shallow: true,
    global: {
      renderStubDefaultSlot: true,
      stubs: { CommonRequestFeedback: RequestFeedback, CommonPageFrame: Frame, teleport: true },
    },
  })
  wrappers.push(wrapper)
  expect(wrapper.find(card).exists()).toBe(true)
  expect(wrapper.get('[role="alert"]').text()).toContain(title)
  await wrapper.get('.request-feedback button').trigger('click')
  expect(mocks.summary.refresh).toHaveBeenCalledTimes(1)
  const pending = mocks.summary.pending as ReturnType<typeof ref<boolean>>
  pending.value = true
  await nextTick()
  await wrapper.get('.request-feedback button').trigger('click')
  expect(mocks.summary.refresh).toHaveBeenCalledTimes(1)
  expect(wrapper.get('[role="status"]').text()).toContain('正在加载')
  const error = mocks.summary.error as ReturnType<typeof ref<Error | null>>
  error.value = null
  pending.value = false
  await nextTick()
  expect(wrapper.find('.request-feedback').exists()).toBe(false)
  expect(wrapper.find(card).exists()).toBe(true)
})

it('Nexus 首次统计失败可重试，且不展示假零统计', async () => {
  mocks.summary.siteStats = ref(null)
  const wrapper = await mountSuspended(NexusLayout, {
    shallow: true,
    global: { renderStubDefaultSlot: true, stubs: { CommonRequestFeedback: RequestFeedback } },
  })
  wrappers.push(wrapper)
  expect(wrapper.find('sidebar-site-stats-card-stub').exists()).toBe(false)
  await wrapper.get('.request-feedback button').trigger('click')
  expect(mocks.summary.refresh).toHaveBeenCalledTimes(1)
})
