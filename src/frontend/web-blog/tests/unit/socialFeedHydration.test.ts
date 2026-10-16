/** @file socialFeedHydration.test.ts @description 公共ID页与原实体仓储一起水合，仅首次挂载补个人状态，回访不重复请求 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useMomentFeed } from '~/composables/useMomentFeed'
import { useMomentStore } from '~/composables/useMomentStore'
import { useGuestbookFeed } from '~/composables/useGuestbookFeed'
import { useGuestbookCache } from '~/composables/useGuestbookCache'
import { invalidatePublicReads } from '~/utils/invalidatePublicReads'
import type { GuestbookRecord } from '~/features/guestbook/types'
const mocks = vi.hoisted(() => ({ moments: vi.fn(), guestbook: vi.fn() }))
mockNuxtImport('useMomentRepository', () => () => ({ list: mocks.moments }))
mockNuxtImport('useGuestbookRepository', () => () => ({ list: mocks.guestbook }))
const note = { id: 'm1', content: '晚间记录', date: '2026-10-16', likes: 1, isLiked: false }
const message: GuestbookRecord = {
  id: 1,
  author: '小林',
  avatar: '',
  content: '午后见闻',
  createdAt: '2026-10-16T01:00:00Z',
  isOwner: false,
  isPinned: false,
  moderationStatus: 'published',
  replyTo: null,
  replyUnavailable: false,
  reactions: [{ emoji: '👍', count: 1, reacted: false }],
}
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  mocks.moments.mockReset().mockResolvedValue({ items: [{ ...note, isLiked: true }], total: 1, page: 1, pageSize: 15 })
  mocks.guestbook.mockReset().mockResolvedValue({
    items: [{ ...message, reactions: [{ emoji: '👍', count: 1, reacted: true }] }],
    total: 1,
    nextCursor: null,
  })
})
afterEach(async () => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  await nextTick()
})

it.each(['moment-feed', 'guestbook-feed'] as const)(
  '%s 水合不重复读公共页，补个人状态后回访命中编号快照',
  async (domain) => {
    let app!: ReturnType<typeof useNuxtApp>
    let priorHydrating = false,
      priorServerRendered: boolean | undefined
    let personal!: () => boolean
    const frames: boolean[] = []
    async function feed() {
      if (domain === 'moment-feed') {
        const state = await useMomentFeed({ page: ref(1), topic: ref(null), date: ref(null), q: ref('') })
        personal = () => state.moments.value[0]?.isLiked === true
      } else {
        const state = await useGuestbookFeed({ q: ref(''), date: ref(null) })
        personal = () => state.items.value[0]?.reactions[0]?.reacted === true
      }
    }
    const loader = domain === 'moment-feed' ? mocks.moments : mocks.guestbook
    try {
      wrappers.push(
        await mountSuspended(
          defineComponent({
            async setup() {
              app = useNuxtApp()
              priorHydrating = app.isHydrating
              priorServerRendered = app.payload.serverRendered
              invalidatePublicReads(app)
              clearNuxtData(domain)
              clearNuxtState([
                'moment-public-items',
                'moment-item-versions',
                'moment-item-clock',
                'moment-collection-generation',
                'moment-personalized-items',
                'guestbook-records',
                'guestbook-record-versions',
                'guestbook-clock',
                'guestbook-generation',
              ])
              app.isHydrating = true
              app.payload.serverRendered = true
              if (domain === 'moment-feed') {
                useMomentStore().accept([note], 0, 0)
                app.payload.data[domain] = {
                  ids: ['m1'],
                  total: 1,
                  page: 1,
                  pageSize: 15,
                  scope: JSON.stringify({ topic: null, date: null, q: '' }),
                  generation: 0,
                  prefixReadAt: Date.now(),
                  chunks: [{ page: 1, ids: ['m1'] }],
                }
              } else {
                useGuestbookCache().accept([message], 0, 0)
                app.payload.data[domain] = {
                  ids: [1],
                  total: 1,
                  nextCursor: null,
                  key: JSON.stringify({ q: '', date: null }),
                  generation: 0,
                  readAt: Date.now(),
                  pages: 1,
                  personalized: false,
                }
              }
              await feed()
              expect(loader).not.toHaveBeenCalled()
              return () => {
                frames.push(personal())
                return h('div')
              }
            },
          }),
        ),
      )
      expect(frames[0]).toBe(false)
      await vi.waitFor(() => expect(personal()).toBe(true))
      expect(loader).toHaveBeenCalledTimes(1)
      wrappers.pop()!.unmount()
      await nextTick()
      app.isHydrating = false
      wrappers.push(
        await mountSuspended(
          defineComponent({
            async setup() {
              await feed()
              return () => h('div')
            },
          }),
        ),
      )
      expect(personal()).toBe(true)
      expect(loader).toHaveBeenCalledTimes(1)
    } finally {
      if (app) {
        app.isHydrating = priorHydrating
        app.payload.serverRendered = priorServerRendered
      }
    }
  },
)
