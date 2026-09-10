/** @file linkFeed.test.ts @description 真实友链列表保留错误前内容，并在水合完成后消费当前URL */
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h, onMounted } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useLinks } from '../../app/composables/useLinks'
const mocks = vi.hoisted(() => ({ list: vi.fn(), metadata: vi.fn() }))
mockNuxtImport('useLinkRepository', () => () => mocks)
const link = {
  id: 1,
  name: '文档站',
  description: '',
  url: 'https://example.com',
  domain: 'example.com',
  avatar: null,
  width: null,
  height: null,
  isFeatured: false,
  publishedAt: '2026-09-10',
}
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  mocks.list.mockReset().mockResolvedValue({ items: [link], total: 1, page: 1, pageSize: 12 })
  mocks.metadata.mockReset().mockResolvedValue({ stats: { links: 1, featured: 0, domains: 1 }, rules: [] })
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
it('失败保留上次真实列表，重试才接受实际空结果', async () => {
  let state!: Awaited<ReturnType<typeof useLinks>>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        async setup() {
          clearNuxtData(['links-feed', 'links-metadata'])
          state = await useLinks()
          return () => h('div')
        },
      }),
      { route: '/links' },
    ),
  )
  mocks.list.mockRejectedValueOnce(new Error('友链断连'))
  await state.refresh()
  expect(state.links.value).toHaveLength(1)
  expect(state.total.value).toBe(1)
  expect(state.error.value).toBeTruthy()
  mocks.list.mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 12 })
  await state.refresh()
  expect(state.total.value).toBe(0)
})
it('SSR页2与当前页1冲突时首render保持SSR，mounted后才发真实页1读取', async () => {
  let state!: Awaited<ReturnType<typeof useLinks>>,
    app!: ReturnType<typeof useNuxtApp>,
    oldHydrating = false,
    oldServerRendered: boolean | undefined,
    mounted = false
  const frames: { page: number; ids: number[]; ready: boolean }[] = [],
    requests: { page: number; mounted: boolean; hydrating: boolean }[] = []
  mocks.list.mockImplementation(async (query: { page: number }) => {
    requests.push({ page: query.page, mounted, hydrating: app.isHydrating })
    return { items: [link], total: 13, page: 1, pageSize: 12 }
  })
  try {
    wrappers.push(
      await mountSuspended(
        defineComponent({
          async setup() {
            app = useNuxtApp()
            oldHydrating = app.isHydrating
            oldServerRendered = app.payload.serverRendered
            clearNuxtData(['links-feed', 'links-metadata'])
            app.isHydrating = true
            app.payload.serverRendered = true
            app.payload.data['links-feed'] = {
              key: JSON.stringify({ page: 2, pageSize: 12 }),
              page: { items: [{ ...link, id: 22 }], total: 13, page: 2, pageSize: 12 },
            }
            app.payload.data['links-metadata'] = { stats: { links: 13, featured: 0, domains: 1 }, rules: [] }
            onMounted(() => {
              mounted = true
            })
            state = await useLinks()
            expect(mocks.list).not.toHaveBeenCalled()
            return () => {
              frames.push({
                page: state.query.value.page,
                ids: state.links.value.map((item) => item.id),
                ready: state.ready.value,
              })
              return h(
                'div',
                state.links.value.map((item) => h('article', item.name)),
              )
            }
          },
        }),
        { route: '/links?page=1' },
      ),
    )
    expect(frames[0]).toEqual({ page: 2, ids: [22], ready: false })
    await vi.waitFor(() => expect(state.links.value[0]?.id).toBe(1))
    expect(requests).toEqual([{ page: 1, mounted: true, hydrating: true }])
  } finally {
    if (app) {
      app.isHydrating = oldHydrating
      app.payload.serverRendered = oldServerRendered
    }
  }
})
