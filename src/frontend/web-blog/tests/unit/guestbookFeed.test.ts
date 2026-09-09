/** @file guestbookFeed.test.ts @description 留言历史分页与已确认回应互不覆盖，失败保留列表，删除和查询切换拒绝旧结果 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useGuestbookFeed } from '~/composables/useGuestbookFeed'
import { useGuestbookCache } from '~/composables/useGuestbookCache'
import { guestbookGroups } from '~/features/guestbook/display'
import type { GuestbookRecord, GuestbookQuery } from '~/features/guestbook/types'
const mocks = vi.hoisted(() => ({ list: vi.fn() }))
mockNuxtImport('useGuestbookRepository', () => () => mocks)
const wrappers: { unmount(): void }[] = []
let data: GuestbookRecord[]
beforeEach(() => {
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
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
async function setup() {
  let feed!: Awaited<ReturnType<typeof useGuestbookFeed>>, cache!: ReturnType<typeof useGuestbookCache>
  const options = { q: ref(''), date: ref<string | null>(null) }
  wrappers.push(
    await mountSuspended(
      defineComponent({
        async setup() {
          clearNuxtData('guestbook-feed')
          clearNuxtState(['guestbook-records', 'guestbook-record-versions', 'guestbook-clock', 'guestbook-generation'])
          cache = useGuestbookCache()
          feed = await useGuestbookFeed(options)
          return () => h('div', String(feed.items.value.length))
        },
      }),
    ),
  )
  await flushPromises()
  return { feed, cache, options }
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
