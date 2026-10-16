/** @file guestbookFeed.test.ts @description 留言历史分页与已确认回应互不覆盖，失败保留列表，删除和查询切换拒绝旧结果 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useGuestbookFeed } from '~/composables/useGuestbookFeed'
import { useGuestbookCache } from '~/composables/useGuestbookCache'
import { guestbookGroups } from '~/features/guestbook/display'
import type { GuestbookRecord, GuestbookQuery } from '~/features/guestbook/types'
import { publicReadCache, publicReadKey } from '~/utils/publicReadCache'
import { invalidatePublicReads } from '~/utils/invalidatePublicReads'
const mocks = vi.hoisted(() => ({ list: vi.fn() }))
mockNuxtImport('useGuestbookRepository', () => () => mocks)
const wrappers: { unmount(): void }[] = []
let data: GuestbookRecord[]
beforeEach(() => {
  publicReadCache(useNuxtApp()).invalidate(['guestbook-feed'])
  data = Array.from({ length: 41 }, (_, index) => ({
    id: index + 1,
    author: '小林',
    avatar: '',
    content: `留言 ${index + 1}`,
    createdAt: '2026-09-09T00:01:00.000Z',
    isOwner: false,
    isPinned: false,
    moderationStatus: 'published',
    replyTo: null,
    replyUnavailable: false,
    reactions: [],
  }))
  mocks.list.mockReset().mockImplementation(async (query: GuestbookQuery) => {
    const filtered = data.filter((item) => !query.q || item.content === query.q)
    const start = Number(query.before || 0)
    return {
      items: filtered.slice(start, start + 20).map((item) => ({ ...item })),
      total: filtered.length,
      nextCursor: start + 20 < filtered.length ? String(start + 20) : null,
    }
  })
})
afterEach(async () => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  await nextTick()
  vi.restoreAllMocks()
})
async function setup(reset = true) {
  let feed!: Awaited<ReturnType<typeof useGuestbookFeed>>, cache!: ReturnType<typeof useGuestbookCache>
  const options = { q: ref(''), date: ref<string | null>(null) }
  wrappers.push(
    await mountSuspended(
      defineComponent({
        async setup() {
          if (reset) {
            clearNuxtData('guestbook-feed')
            clearNuxtState([
              'guestbook-records',
              'guestbook-record-versions',
              'guestbook-clock',
              'guestbook-generation',
            ])
          }
          cache = useGuestbookCache()
          feed = await useGuestbookFeed(options)
          return () => h('div', String(feed.items.value.length))
        },
      }),
    ),
  )
  await flushPromises()
  return { feed, cache, options, wrapper: wrappers.at(-1)! }
}
it('追加历史保留当前回应，不重复同一条留言', async () => {
  const { feed, cache } = await setup()
  cache.patch(1, { reactions: [{ emoji: '👍', count: 1, reacted: true }] })
  await feed.loadMore()
  expect(feed.items.value).toHaveLength(40)
  expect(new Set(feed.items.value.map((item) => item.id)).size).toBe(40)
  expect(feed.items.value[0]!.reactions[0]!.reacted).toBe(true)
})
it('历史加载失败保留原列表，重试沿用同一游标', async () => {
  const { feed } = await setup()
  mocks.list.mockRejectedValueOnce(new Error('暂时不可用'))
  await feed.loadMore()
  expect(feed.items.value).toHaveLength(20)
  expect(feed.moreError.value).toBe('暂时不可用')
  await feed.retryMore()
  expect(feed.items.value).toHaveLength(40)
  expect(feed.moreError.value).toBe('')
})
it('删除后的迟到历史不能复活内容', async () => {
  const { feed, cache } = await setup()
  let finish!: (value: unknown) => void
  mocks.list.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const pending = feed.loadMore()
  await flushPromises()
  cache.invalidate(1)
  data = data.filter((item) => item.id !== 1)
  finish({ items: data.slice(20, 40), total: 40, nextCursor: null })
  await pending
  expect(feed.items.value.some((item) => item.id === 1)).toBe(false)
  await feed.refresh()
  expect(feed.items.value.some((item) => item.id === 1)).toBe(false)
})
it('快速改换查询后只接收最终条件', async () => {
  const { feed, options } = await setup()
  options.q.value = '留言 1'
  options.q.value = '留言 2'
  await vi.waitFor(() => expect(feed.items.value.map((item) => item.content)).toEqual(['留言 2']))
})
it('两种显示顺序使用同一记录与UTC日期，且不修改源数组', () => {
  const before = [...data]
  expect(guestbookGroups(data, true)[0]!.messages[0]!.id).toBe(1)
  expect(guestbookGroups(data, false)[0]!.messages[0]!.id).toBe(41)
  expect(guestbookGroups(data, true)[0]!.date).toBe('2026-09-09')
  expect(data).toEqual(before)
})

it('游标追加后回访命中原范围，回应继续来自既有实体且手动刷新访问接口', async () => {
  const first = await setup()
  await first.feed.loadMore()
  first.cache.patch(1, { reactions: [{ emoji: '👍', count: 1, reacted: true }] })
  first.wrapper.unmount()
  wrappers.pop()
  await nextTick()
  const second = await setup(false)
  expect(mocks.list).toHaveBeenCalledTimes(2)
  expect(second.feed.items.value).toHaveLength(40)
  expect(second.feed.items.value[0]?.reactions[0]?.reacted).toBe(true)
  mocks.list.mockClear()
  await second.feed.refresh()
  expect(mocks.list.mock.calls.map((call) => call[0].before)).toEqual([undefined, '20'])
})

it('公共投影没有待审编号或个人总数游标，弱关联索引计入同一容量并随代次失效', async () => {
  data[0] = {
    ...data[0]!,
    id: 987654,
    moderationStatus: 'pending',
    content: '个人待审正文',
    reactions: [{ emoji: '👍', count: 1, reacted: true }],
  }
  const first = await setup()
  const lru = publicReadCache(useNuxtApp())
  const key = publicReadKey('guestbook-feed', { pageSize: 20 })
  const cached = lru.read<unknown>(key)!
  expect(cached).toBeDefined()
  expect(JSON.stringify(cached.value)).not.toContain('987654')
  for (const field of ['total', 'nextCursor', 'reactions', 'reacted', 'personalized'])
    expect(cached.value).not.toHaveProperty(field)
  expect(JSON.stringify(cached.value)).not.toContain('个人待审正文')
  const privateIndex = first.cache.restore(cached.value)!
  expect(privateIndex.ids).toContain(987654)
  const encoded = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength
  expect(lru.size().bytes).toBeGreaterThanOrEqual(encoded(cached.value) + encoded(privateIndex))
  first.wrapper.unmount()
  wrappers.pop()
  await nextTick()
  const second = await setup(false)
  expect(mocks.list).toHaveBeenCalledTimes(1)
  expect(second.feed.items.value[0]?.id).toBe(987654)
  data = data.filter((item) => item.id !== 987654)
  mocks.list.mockRejectedValueOnce(new Error('身份变化后暂不可用'))
  invalidatePublicReads(useNuxtApp())
  expect(second.feed.items.value).toEqual([])
  expect(first.cache.restore(cached.value)).toBeUndefined()
  await flushPromises()
  expect(second.feed.items.value).toEqual([])
})

it('过期失败保留原游标范围，重试重新核对全部已读页', async () => {
  let now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  const first = await setup()
  await first.feed.loadMore()
  first.wrapper.unmount()
  wrappers.pop()
  await nextTick()
  now += 31_000
  mocks.list.mockRejectedValueOnce(new Error('历史暂不可用'))
  const second = await setup(false)
  await flushPromises()
  expect(second.feed.items.value).toHaveLength(40)
  expect(second.feed.error.value).toBeTruthy()
  data = data.filter((item) => item.id !== 1)
  await second.feed.refresh()
  expect(second.feed.items.value).toHaveLength(40)
  expect(second.feed.items.value.some((item) => item.id === 1)).toBe(false)
})

it('t29追加后t310离线回访不能恢复已过五分钟的游标索引', async () => {
  let now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  const first = await setup()
  now += 29_000
  await first.feed.loadMore()
  expect(first.feed.items.value).toHaveLength(40)
  first.wrapper.unmount()
  wrappers.pop()
  await nextTick()
  now += 281_000
  mocks.list.mockRejectedValueOnce(new Error('离线'))
  const second = await setup(false)
  await flushPromises()
  expect(second.cache.entries.value[1]).toBeDefined()
  expect(second.feed.error.value).toBeTruthy()
  expect(second.feed.items.value).toEqual([])
})
