/** @file promptFeed.test.ts @description 提示词列表失败保留真实成功页，URL 查询只接受最后响应 */
import { publicReadCache } from '../../app/utils/publicReadCache'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, onMounted } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { usePrompts } from '../../app/composables/usePrompts'
const mocks = vi.hoisted(() => ({ list: vi.fn(), metadata: vi.fn() }))
mockNuxtImport('usePromptRepository', () => () => mocks)
const prompt = {
  id: 1,
  title: '午后光影',
  description: '',
  prompt: 'A sunlit room',
  negativePrompt: '',
  imageUrl: '/image.webp',
  imageAlt: '午后房间',
  sourceUrl: '',
  width: null,
  height: null,
  model: 'Midjourney',
  tags: [],
  publishedAt: '2026-09-10',
}
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  publicReadCache(useNuxtApp()).invalidate(['prompts'])
  mocks.list.mockReset().mockResolvedValue({ items: [prompt], total: 1, page: 1, pageSize: 12 })
  mocks.metadata.mockReset().mockResolvedValue({
    stats: { prompts: 1, models: 1, tags: 0 },
    models: [{ label: 'Midjourney', count: 1 }],
    tags: [],
  })
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
async function setup() {
  let state!: Awaited<ReturnType<typeof usePrompts>>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        async setup() {
          clearNuxtData(['prompts-feed', 'prompts-metadata'])
          state = await usePrompts()
          return () => h('div')
        },
      }),
      { route: '/prompts' },
    ),
  )
  return state
}
it('读取失败不伪造空列表或零统计，重试恢复真实结果', async () => {
  const state = await setup()
  mocks.list.mockRejectedValueOnce(new Error('提示词暂不可用'))
  await state.refresh()
  expect(state.error.value?.message).toBe('提示词暂不可用')
  expect(state.prompts.value).toHaveLength(1)
  expect(state.total.value).toBe(1)
  expect(state.stale.value).toBe(true)
  mocks.list.mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 12 })
  await state.refresh()
  expect(state.total.value).toBe(0)
  expect(state.error.value).toBeUndefined()
  expect(state.stale.value).toBe(false)
})
it('相同查询重新读取时明确保留旧结果，成功后取消过期标记', async () => {
  const state = await setup()
  let finish!: (value: unknown) => void
  mocks.list.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const refreshing = state.refresh()
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  expect(state.pending.value).toBe(true)
  expect(state.stale.value).toBe(true)
  expect(state.prompts.value[0]?.id).toBe(1)
  finish({ items: [{ ...prompt, id: 2 }], total: 1, page: 1, pageSize: 12 })
  await refreshing
  expect(state.prompts.value[0]?.id).toBe(2)
  expect(state.stale.value).toBe(false)
})
it('快速切换模型和风格标签，迟到列表不回滚最新筛选', async () => {
  const state = await setup()
  let finish!: (value: unknown) => void
  mocks.list.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  await state.changeQuery({ model: 'GPT Image' })
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  mocks.list.mockResolvedValueOnce({
    items: [{ ...prompt, id: 2, title: '新提示词' }],
    total: 1,
    page: 1,
    pageSize: 12,
  })
  await state.changeQuery({ model: 'Midjourney', tag: '静物' })
  await vi.waitFor(() =>
    expect(
      state.prompts.value[0]?.id,
      JSON.stringify({ query: state.query.value, calls: mocks.list.mock.calls.map((call) => call[0]) }),
    ).toBe(2),
  )
  finish({ items: [prompt], total: 1, page: 1, pageSize: 12 })
  await Promise.resolve()
  expect(state.prompts.value[0]?.id).toBe(2)
  expect(state.query.value.tag).toBe('静物')
})
it('SSR第2页与已后退到第1页的路由冲突时，首帧仍用SSR卡片且挂载后才读取第1页', async () => {
  let state!: Awaited<ReturnType<typeof usePrompts>>
  let app!: ReturnType<typeof useNuxtApp>
  let priorHydrating = false,
    priorServerRendered: boolean | undefined
  const frames: { ready: boolean; page: number; ids: number[] }[] = []
  const requests: { page: number; mounted: boolean; hydrating: boolean }[] = []
  let mounted = false
  const serverItem = { ...prompt, id: 22, title: 'SSR第2页提示词' }
  mocks.list.mockImplementation(async (query: { page: number }) => {
    requests.push({ page: query.page, mounted, hydrating: app.isHydrating })
    return { items: [prompt], total: 13, page: 1, pageSize: 12 }
  })
  try {
    const wrapper = await mountSuspended(
      defineComponent({
        async setup() {
          app = useNuxtApp()
          priorHydrating = app.isHydrating
          priorServerRendered = app.payload.serverRendered
          clearNuxtData(['prompts-feed', 'prompts-metadata'])
          app.isHydrating = true
          app.payload.serverRendered = true
          app.payload.data['prompts-feed'] = {
            key: JSON.stringify({ page: 2, pageSize: 12 }),
            page: { items: [serverItem], total: 13, page: 2, pageSize: 12 },
          }
          app.payload.data['prompts-metadata'] = {
            stats: { prompts: 13, models: 1, tags: 0 },
            models: [{ label: 'Midjourney', count: 13 }],
            tags: [],
          }
          onMounted(() => {
            mounted = true
          })
          state = await usePrompts()
          expect(app.isHydrating).toBe(true)
          expect(mocks.list).not.toHaveBeenCalled()
          return () => {
            frames.push({
              ready: state.ready.value,
              page: state.query.value.page,
              ids: state.prompts.value.map((item) => item.id),
            })
            return h(
              'section',
              state.prompts.value.map((item) => h('article', { 'data-prompt-id': item.id }, item.title)),
            )
          }
        },
      }),
      { route: '/prompts?page=1' },
    )
    wrappers.push(wrapper)
    expect(frames[0]).toEqual({ ready: false, page: 2, ids: [22] })
    await vi.waitFor(() => expect(state.prompts.value.map((item) => item.id)).toEqual([1]))
    expect(state.query.value.page).toBe(1)
    expect(requests).toEqual([{ page: 1, mounted: true, hydrating: true }])
    expect(wrapper.findAll('article').map((item) => item.attributes('data-prompt-id'))).toEqual(['1'])
    expect(app.payload.data['prompts-feed'].key).toBe(JSON.stringify({ page: 1, pageSize: 12 }))
  } finally {
    if (app) {
      app.isHydrating = priorHydrating
      app.payload.serverRendered = priorServerRendered
    }
  }
})
