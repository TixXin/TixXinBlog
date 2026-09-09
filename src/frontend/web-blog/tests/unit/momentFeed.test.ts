/** @file momentFeed.test.ts @description 朋友圈分页不会回滚互动，删除和筛选后的旧响应不能复活内容 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useMomentFeed } from '../../app/composables/useMomentFeed'
import { useMomentStore } from '../../app/composables/useMomentStore'
import type { MomentItem, MomentQuery } from '../../app/features/moment/types'

const mocks = vi.hoisted(() => ({ list: vi.fn() }))
mockNuxtImport('useMomentRepository', () => () => mocks)
let dataset: MomentItem[] = []
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
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
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
async function setup() {
  const options = { page: ref(1), topic: ref<string | null>(null), date: ref<string | null>(null), q: ref('') }
  let state!: Awaited<ReturnType<typeof useMomentFeed>>, store!: ReturnType<typeof useMomentStore>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        async setup() {
          clearNuxtData('moment-feed')
          clearNuxtState([
            'moment-public-items',
            'moment-item-versions',
            'moment-item-clock',
            'moment-collection-generation',
          ])
          store = useMomentStore()
          state = await useMomentFeed(options)
          return () => h('div', String(state.moments.value.length))
        },
      }),
    ),
  )
  await flushPromises()
  return { state, store, options }
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
    store.forget('moment-0')
    finish({ items: dataset.slice(0, 15), total: 31, page: 1, pageSize: 15 })
    await reading
    expect(state.moments.value.some((note) => note.id === 'moment-0')).toBe(false)
    dataset = dataset.filter((note) => note.id !== 'moment-0')
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
})
