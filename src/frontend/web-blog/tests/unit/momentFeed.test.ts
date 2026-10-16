/** @file momentFeed.test.ts @description 朋友圈分页不会回滚互动，删除和筛选后的旧响应不能复活内容 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useMomentFeed } from '../../app/composables/useMomentFeed'
import { useMomentStore } from '../../app/composables/useMomentStore'
import type { MomentItem, MomentQuery } from '../../app/features/moment/types'
import { publicReadCache, publicReadKey } from '../../app/utils/publicReadCache'

const mocks = vi.hoisted(() => ({ list: vi.fn() }))
mockNuxtImport('useMomentRepository', () => () => mocks)
let dataset: MomentItem[] = []
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  publicReadCache(useNuxtApp()).invalidate(['moment-feed'])
  dataset = Array.from({ length: 31 }, (_, index) => ({
    id: `moment-${index}`,
    content: `动态 ${index}`,
    date: '2026-09-09',
    likes: 0,
    isLiked: false,
  }))
  mocks.list.mockReset().mockImplementation(async (query: MomentQuery) => {
    const filtered = dataset.filter((note) => !query.q || note.content.includes(query.q))
    return {
      items: filtered.slice((query.page - 1) * 15, query.page * 15).map((note) => ({ ...note })),
      total: filtered.length,
      page: query.page,
      pageSize: 15,
    }
  })
})
afterEach(async () => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  await nextTick()
  vi.restoreAllMocks()
})
async function setup(reset = true, initialPage = 1) {
  const options = {
    page: ref(initialPage),
    topic: ref<string | null>(null),
    date: ref<string | null>(null),
    q: ref(''),
  }
  let state!: Awaited<ReturnType<typeof useMomentFeed>>, store!: ReturnType<typeof useMomentStore>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        async setup() {
          if (reset) {
            clearNuxtData('moment-feed')
            clearNuxtState([
              'moment-public-items',
              'moment-item-versions',
              'moment-item-clock',
              'moment-collection-generation',
              'moment-personalized-items',
            ])
          }
          store = useMomentStore()
          state = await useMomentFeed(options)
          return () => h('div', String(state.moments.value.length))
        },
      }),
    ),
  )
  await flushPromises()
  return { state, store, options, wrapper: wrappers.at(-1)! }
}
describe('朋友圈数据请求', () => {
  it('追加第二页不会将第一页已确认的点赞回滚', async () => {
    const { state, store, options } = await setup()
    store.patch('moment-0', { likes: 1, isLiked: true })
    options.page.value = 2
    await vi.waitFor(() => expect(state.moments.value).toHaveLength(30))
    expect(state.moments.value[0]).toMatchObject({ likes: 1, isLiked: true })
  })
  it('迟到响应无法复活已删除动态，完整刷新会重新核对已缓存页', async () => {
    const { state, store } = await setup()
    let finish!: (value: unknown) => void
    mocks.list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const reading = state.refresh()
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    const oldItems = dataset.slice(0, 15).map((note) => ({ ...note }))
    dataset = dataset.filter((note) => note.id !== 'moment-0')
    store.forget('moment-0')
    finish({ items: oldItems, total: 31, page: 1, pageSize: 15 })
    await reading
    expect(state.moments.value.some((note) => note.id === 'moment-0')).toBe(false)
    await state.refresh()
    expect(state.total.value).toBe(30)
    expect(state.moments.value[0]?.id).toBe('moment-1')
  })
  it('失败保留已读内容，重试后恢复真实页', async () => {
    const { state } = await setup()
    const ids = state.moments.value.map((note) => note.id)
    mocks.list.mockRejectedValueOnce(new Error('网络失败'))
    await state.refresh()
    expect(state.error.value).toBeTruthy()
    expect(state.moments.value.map((note) => note.id)).toEqual(ids)
    await state.refresh()
    expect(state.error.value).toBeFalsy()
  })
  it('快速修改关键词仅接受最后筛选，旧内容在等待时保持可见', async () => {
    const { state, options } = await setup()
    mocks.list.mockClear()
    options.q.value = '动态 1'
    options.q.value = '动态 30'
    expect(state.moments.value).toHaveLength(15)
    await vi.waitFor(() => expect(state.moments.value.map((note) => note.id)).toEqual(['moment-30']))
    expect(mocks.list).toHaveBeenCalledTimes(1)
  })

  it('回访命中编号快照，个人点赞只从既有实体仓储恢复', async () => {
    const first = await setup()
    first.store.patch('moment-0', { likes: 2, isLiked: true })
    first.wrapper.unmount()
    wrappers.pop()
    await nextTick()
    const second = await setup(false)
    expect(mocks.list).toHaveBeenCalledTimes(1)
    expect(second.state.moments.value[0]).toMatchObject({ likes: 2, isLiked: true })
    const snapshot = publicReadCache(useNuxtApp()).read(
      publicReadKey('moment-feed', {
        scope: JSON.stringify({ topic: null, date: null, q: '' }),
        page: 1,
      }),
    )
    expect(snapshot).toBeDefined()
    const serialized = JSON.stringify(snapshot!.value)
    for (const privateField of ['isLiked', 'likes', 'content', 'comments', 'personalized'])
      expect(serialized).not.toContain(privateField)
  })

  it('过期回访重读完整前缀，失败保留旧内容，手动刷新移除撤回记录', async () => {
    let now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const first = await setup(true, 2)
    first.wrapper.unmount()
    wrappers.pop()
    await nextTick()
    now += 31_000
    mocks.list.mockRejectedValueOnce(new Error('暂时离线'))
    const second = await setup(false, 2)
    await flushPromises()
    expect(second.state.moments.value).toHaveLength(30)
    expect(second.state.error.value).toBeTruthy()
    dataset = dataset.filter((note) => note.id !== 'moment-0')
    mocks.list.mockClear()
    await second.state.refresh()
    expect(mocks.list.mock.calls.map((call) => call[0].page)).toEqual([1, 2])
    expect(second.state.moments.value).toHaveLength(30)
    expect(second.state.moments.value.some((note) => note.id === 'moment-0')).toBe(false)
  })

  it('t29追加后t310离线回访不能从原实体仓储恢复过期编号页', async () => {
    let now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const first = await setup()
    now += 29_000
    first.options.page.value = 2
    await vi.waitFor(() => expect(first.state.moments.value).toHaveLength(30))
    first.wrapper.unmount()
    wrappers.pop()
    await nextTick()
    now += 281_000
    mocks.list.mockRejectedValueOnce(new Error('离线'))
    const second = await setup(false, 2)
    await flushPromises()
    expect(second.store.entries.value['moment-0']).toBeDefined()
    expect(second.state.error.value).toBeTruthy()
    expect(second.state.moments.value).toEqual([])
  })
})
