/** @file socialMetadata.test.ts @description 社交栏目统计独立懒加载、60秒回访缓存及置顶记录个人字段隔离 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useMomentOverview } from '~/composables/useMomentOverview'
import { useGuestbookMetadata } from '~/composables/useGuestbookMetadata'
import { invalidatePublicReads } from '~/utils/invalidatePublicReads'
import { publicReadCache, publicReadKey } from '~/utils/publicReadCache'
const mocks = vi.hoisted(() => ({ overview: vi.fn(), metadata: vi.fn() }))
mockNuxtImport('useMomentRepository', () => () => ({ overview: mocks.overview }))
mockNuxtImport('useGuestbookRepository', () => () => ({ metadata: mocks.metadata }))
const overview = {
  stats: { totalMoments: 2, totalLikes: 3, totalComments: 1 },
  topics: [],
  dates: [],
  photos: [],
  recollections: [],
}
const metadata = {
  stats: { messages: 1, members: 1, recent: 1, today: 1 },
  members: [],
  rules: [],
  pinned: {
    id: 1,
    author: '小林',
    avatar: '',
    content: '欢迎交流',
    createdAt: '2026-10-16T01:00:00Z',
    isOwner: true,
    isPinned: true,
    moderationStatus: 'published',
    replyTo: null,
    replyUnavailable: false,
    reactions: [{ emoji: '👍', count: 1, reacted: true }],
  },
}
type Domain = 'moment-overview' | 'guestbook-metadata'
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  invalidatePublicReads(useNuxtApp())
  clearNuxtData(['moment-overview', 'guestbook-metadata'])
  mocks.overview.mockReset().mockResolvedValue(overview)
  mocks.metadata.mockReset().mockResolvedValue(metadata)
})
afterEach(async () => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  await nextTick()
  vi.restoreAllMocks()
})
async function mountMetadata(domain: Domain, immediate = true) {
  let state!: {
    data: { value: unknown }
    pending: { value: boolean }
    error: { value: unknown }
    refresh: () => Promise<void>
  }
  const wrapper = await mountSuspended(
    defineComponent({
      async setup() {
        if (domain === 'moment-overview') {
          const result = await useMomentOverview({ immediate })
          state = { data: result.metadata, pending: result.pending, error: result.error, refresh: result.refresh }
        } else state = await useGuestbookMetadata()
        return () => h('div', { 'data-view-ready': '' })
      },
    }),
  )
  wrappers.push(wrapper)
  return { state, wrapper }
}

it.each(['moment-overview', 'guestbook-metadata'] as const)('%s 不阻塞客户端页面就绪，回访复用统计', async (domain) => {
  const loader = domain === 'moment-overview' ? mocks.overview : mocks.metadata
  const value = domain === 'moment-overview' ? overview : metadata
  let finish!: (value: unknown) => void
  loader.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const first = await mountMetadata(domain)
  expect(first.wrapper.find('[data-view-ready]').exists()).toBe(true)
  expect(first.state.data.value).toBeNull()
  finish(value)
  await vi.waitFor(() => expect(first.state.data.value).toEqual(value))
  first.wrapper.unmount()
  wrappers.pop()
  await nextTick()
  const second = await mountMetadata(domain)
  await flushPromises()
  expect(second.state.data.value).toEqual(value)
  expect(loader).toHaveBeenCalledTimes(1)
})

it.each(['moment-overview', 'guestbook-metadata'] as const)(
  '%s 统计60秒过期后重验证，失败保留且手动刷新访问接口',
  async (domain) => {
    let now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const loader = domain === 'moment-overview' ? mocks.overview : mocks.metadata
    const first = await mountMetadata(domain)
    await vi.waitFor(() => expect(first.state.data.value).not.toBeNull())
    first.wrapper.unmount()
    wrappers.pop()
    await nextTick()
    now += 59_000
    const fresh = await mountMetadata(domain)
    await flushPromises()
    expect(loader).toHaveBeenCalledTimes(1)
    fresh.wrapper.unmount()
    wrappers.pop()
    await nextTick()
    now += 2_000
    loader.mockRejectedValueOnce(new Error('统计暂时离线'))
    const stale = await mountMetadata(domain)
    await flushPromises()
    expect(stale.state.data.value).not.toBeNull()
    expect(stale.state.error.value).toBeTruthy()
    expect(loader).toHaveBeenCalledTimes(2)
    await stale.state.refresh()
    expect(loader).toHaveBeenCalledTimes(3)
    expect(stale.state.error.value).toBeUndefined()
  },
)

it('朋友圈壳层immediate=false不启动读取，显式刷新后读取真实统计', async () => {
  const { state } = await mountMetadata('moment-overview', false)
  await flushPromises()
  expect(mocks.overview).not.toHaveBeenCalled()
  expect(state.data.value).toBeNull()
  await state.refresh()
  expect(mocks.overview).toHaveBeenCalledTimes(1)
  expect(state.data.value).toEqual(overview)
})

it('共享统计超过五分钟的冷读取仍不阻塞新的客户端页面', async () => {
  let now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  const first = await mountMetadata('moment-overview')
  await vi.waitFor(() => expect(first.state.data.value).not.toBeNull())
  now += 301_000
  let finish!: (value: unknown) => void
  mocks.overview.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const second = await mountMetadata('moment-overview')
  expect(second.wrapper.find('[data-view-ready]').exists()).toBe(true)
  expect(second.state.data.value).toBeNull()
  expect(mocks.overview).toHaveBeenCalledTimes(2)
  finish(overview)
  await vi.waitFor(() => expect(second.state.data.value).toEqual(overview))
})

it('留言统计仅缓存置顶编号，个人回应留在实体仓储中', async () => {
  const { state } = await mountMetadata('guestbook-metadata')
  await vi.waitFor(() => expect(state.data.value).not.toBeNull())
  const cached = publicReadCache(useNuxtApp()).read(publicReadKey('guestbook-metadata'))!
  expect(cached).toBeDefined()
  expect(cached.value).toHaveProperty('pinnedId', 1)
  expect(cached.value).not.toHaveProperty('pinned')
  for (const field of ['reacted', 'reactions', '欢迎交流']) expect(JSON.stringify(cached.value)).not.toContain(field)
})
