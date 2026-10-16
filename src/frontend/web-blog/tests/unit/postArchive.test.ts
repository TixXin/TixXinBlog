/** @file postArchive.test.ts @description 归档URL、单页分组、失败保留与快速年份切换的响应所有权 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { usePostArchive } from '../../app/composables/usePostArchive'
import { fetchPostArchive } from '../../app/features/post/api'
import { postArchiveQuery, postArchiveYears } from '../../app/features/post/archive'
import type { PostArchivePage } from '../../app/features/post/types'
import { invalidatePublicReads } from '../../app/utils/invalidatePublicReads'

vi.mock('../../app/features/post/api', () => ({ fetchPostArchive: vi.fn() }))
const sample: PostArchivePage = {
  items: [{ id: 1, title: '记录春日', folder: '随笔', date: '2026-03-01T00:00:00.000Z' }],
  total: 101,
  page: 1,
  pageSize: 50,
  years: [{ year: 2026, count: 101 }],
}
const wrappers: { unmount(): void }[] = []
let testApp!: ReturnType<typeof useNuxtApp>
beforeEach(() => {
  vi.mocked(fetchPostArchive).mockReset().mockResolvedValue(sample)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})

async function setup(route = '/archive') {
  let state!: Awaited<ReturnType<typeof usePostArchive>>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        async setup() {
          testApp = useNuxtApp()
          invalidatePublicReads(testApp, ['archive'])
          clearNuxtData('post-archive')
          state = await usePostArchive()
          return () => h('div')
        },
      }),
      { route },
    ),
  )
  return state
}

it('规范年份与页码，年份总数不被当前页的条数替代', () => {
  expect(postArchiveQuery({ year: '2026', page: '2' })).toEqual({ year: 2026, page: 2, pageSize: 50 })
  expect(postArchiveQuery({ year: 'no', page: '-1' })).toEqual({ year: undefined, page: 1, pageSize: 50 })
  expect(postArchiveYears(sample)[0]).toMatchObject({ year: 2026, count: 101 })
  expect(postArchiveYears(sample)[0]?.posts).toHaveLength(1)
})

it('同筛选刷新失败保留成功页，首次失败不伪造空归档', async () => {
  vi.mocked(fetchPostArchive).mockRejectedValueOnce(new Error('暂不可用'))
  const state = await setup()
  expect(state.current.value).toBeNull()
  expect(state.error.value).toBeTruthy()
  await state.refresh()
  expect(state.current.value?.total).toBe(101)
  vi.mocked(fetchPostArchive).mockRejectedValueOnce(new Error('读取中断'))
  await state.refresh()
  expect(state.current.value?.items[0]?.id).toBe(1)
  expect(state.error.value?.message).toBe('读取中断')
})

it.each([
  { name: '翻页', year: 2026, page: 2 },
  { name: '换年', year: 2025, page: 3 },
])('$name 等待及失败保留旧50条和来源，但旧total不能归一新条件，重试后替换', async (target) => {
  const oldPage: PostArchivePage = {
    ...sample,
    total: 50,
    years: [{ year: 2026, count: 50 }],
    items: Array.from({ length: 50 }, (_, index) => ({
      ...sample.items[0]!,
      id: index + 1,
      title: `春日记录 ${index + 1}`,
    })),
  }
  vi.mocked(fetchPostArchive).mockResolvedValueOnce(oldPage)
  const state = await setup('/archive?year=2026')
  let fail!: (error: Error) => void
  vi.mocked(fetchPostArchive).mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject
      }),
  )
  await state.changeQuery({ year: target.year, page: target.page })
  await vi.waitFor(() => expect(fail).toBeTypeOf('function'))
  expect(state.pending.value).toBe(true)
  expect(state.current.value).toBeNull()
  expect(state.displayed.value?.items).toHaveLength(50)
  expect(state.archiveYears.value[0]?.posts).toHaveLength(50)
  expect(state.displayedQuery.value).toMatchObject({ year: 2026, page: 1 })
  expect(state.stale.value).toBe(true)
  expect(state.query.value).toMatchObject({ year: target.year, page: target.page })
  fail(new Error('新筛选读取失败'))
  await vi.waitFor(() => expect(state.error.value).toBeTruthy())
  expect(state.displayed.value?.items).toEqual(oldPage.items)
  expect(state.current.value).toBeNull()
  expect(state.query.value).toMatchObject({ year: target.year, page: target.page })
  const replacement: PostArchivePage = {
    ...oldPage,
    page: target.page,
    total: 150,
    years: [{ year: target.year, count: 150 }],
    items: oldPage.items.map((item) => ({ ...item, id: item.id + 100, date: `${target.year}-03-01T00:00:00.000Z` })),
  }
  vi.mocked(fetchPostArchive).mockResolvedValueOnce(replacement)
  await state.refresh()
  await vi.waitFor(() => expect(state.current.value?.items).toEqual(replacement.items))
  expect(state.displayed.value?.items).toEqual(replacement.items)
  expect(state.displayedQuery.value).toMatchObject({ year: target.year, page: target.page })
  expect(state.stale.value).toBe(false)
})

it('快速切换年份取消旧读取，迟到响应不覆盖新年份', async () => {
  const state = await setup()
  let finish!: (value: PostArchivePage) => void
  vi.mocked(fetchPostArchive).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  await state.changeQuery({ year: 2025, page: 1 })
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  const recent = { ...sample, items: [{ ...sample.items[0]!, id: 2 }], total: 1 }
  vi.mocked(fetchPostArchive).mockResolvedValueOnce(recent)
  await state.changeQuery({ year: 2026, page: 1 })
  await vi.waitFor(() => expect(state.current.value?.items[0]?.id).toBe(2))
  finish(sample)
  await Promise.resolve()
  expect(state.current.value?.items[0]?.id).toBe(2)
})

it('深链过大页码收到真实总量后归一到最后一页', async () => {
  vi.mocked(fetchPostArchive).mockImplementation(async (_base, query) => ({
    ...sample,
    page: query.page,
    items: query.page > 3 ? [] : sample.items,
  }))
  const state = await setup('/archive?page=999')
  await vi.waitFor(() => expect(state.query.value.page).toBe(3))
  await vi.waitFor(() => expect(state.current.value?.page).toBe(3))
})

it('末页删除后的归一目标强制读取，不采用仍在有效期内的旧总数', async () => {
  let now = 1_000_000,
    total = 101
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  vi.mocked(fetchPostArchive).mockImplementation(async (_base, query) => ({
    ...sample,
    total,
    page: query.page,
    items: query.page > Math.ceil(total / 50) ? [] : [{ ...sample.items[0]!, id: query.page }],
    years: [{ year: 2026, count: total }],
  }))
  const state = await setup('/archive?year=2026&page=3')
  now += 20_000
  await state.changeQuery({ page: 2 })
  await vi.waitFor(() => expect(state.current.value?.page).toBe(2))
  expect(state.current.value?.total).toBe(101)
  now += 11_000
  total = 100
  await state.changeQuery({ page: 3 })
  await vi.waitFor(() => expect(state.query.value.page).toBe(2))
  await vi.waitFor(() => expect(state.current.value?.total).toBe(100))
  expect(state.pageCount.value).toBe(2)
  expect(state.query.value.year).toBe(2026)
  expect(vi.mocked(fetchPostArchive).mock.calls.map((call) => call[1].page)).toEqual([3, 2, 3, 2])
})

it('水合首帧保持SSR页码，挂载后才消费已变化的历史URL', async () => {
  let state!: Awaited<ReturnType<typeof usePostArchive>>
  let app!: ReturnType<typeof useNuxtApp>
  let priorHydrating = false,
    priorServerRendered: boolean | undefined
  const frames: { ready: boolean; page: number; id?: number }[] = []
  try {
    wrappers.push(
      await mountSuspended(
        defineComponent({
          async setup() {
            app = useNuxtApp()
            invalidatePublicReads(app, ['archive'])
            priorHydrating = app.isHydrating
            priorServerRendered = app.payload.serverRendered
            clearNuxtData('post-archive')
            app.isHydrating = true
            app.payload.serverRendered = true
            app.payload.data['post-archive'] = {
              key: JSON.stringify({ page: 2, pageSize: 50 }),
              page: { ...sample, page: 2, items: [{ ...sample.items[0], id: 52 }] },
            }
            state = await usePostArchive()
            expect(fetchPostArchive).not.toHaveBeenCalled()
            return () => {
              frames.push({
                ready: state.ready.value,
                page: state.query.value.page,
                id: state.current.value?.items[0]?.id,
              })
              return h('div')
            }
          },
        }),
        { route: '/archive' },
      ),
    )
    expect(frames[0]).toEqual({ ready: false, page: 2, id: 52 })
    await vi.waitFor(() => expect(state.current.value?.items[0]?.id).toBe(1))
    expect(state.query.value.page).toBe(1)
    expect(fetchPostArchive).toHaveBeenCalledTimes(1)
  } finally {
    if (app) {
      app.isHydrating = priorHydrating
      app.payload.serverRendered = priorServerRendered
    }
  }
})

it('返回已读年份命中缓存，写后失效及失败不能恢复旧归档', async () => {
  const state = await setup()
  await state.changeQuery({ year: 2025, page: 1 })
  await vi.waitFor(() => expect(fetchPostArchive).toHaveBeenCalledTimes(2))
  await state.changeQuery({ year: 2026, page: 1 })
  await vi.waitFor(() => expect(fetchPostArchive).toHaveBeenCalledTimes(3))
  await state.changeQuery({ year: 2025, page: 1 })
  await vi.waitFor(() => expect(state.current.value?.total).toBe(101))
  expect(fetchPostArchive).toHaveBeenCalledTimes(3)
  vi.mocked(fetchPostArchive).mockRejectedValueOnce(new Error('失效后读取失败'))
  invalidatePublicReads(testApp, ['archive'])
  expect(state.current.value).toBeNull()
  expect(state.displayed.value).toBeNull()
  await vi.waitFor(() => expect(state.error.value?.message).toBe('失效后读取失败'))
  expect(state.current.value).toBeNull()
  expect(state.displayed.value).toBeNull()
})
