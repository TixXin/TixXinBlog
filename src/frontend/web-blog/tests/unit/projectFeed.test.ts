/** @file projectFeed.test.ts @description 项目列表失败保留真实成功页，URL 查询只接受最后响应 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, onMounted } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useProjects } from '../../app/composables/useProjects'
const mocks = vi.hoisted(() => ({ list: vi.fn(), metadata: vi.fn() }))
mockNuxtImport('useProjectRepository', () => () => mocks)
const project = {
  id: 1,
  title: '创作工作台',
  description: '',
  cover: null,
  width: null,
  height: null,
  progress: 'active',
  tags: [],
  links: [],
  publishedAt: '2026-09-10',
}
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  mocks.list.mockReset().mockResolvedValue({ items: [project], total: 1, page: 1, pageSize: 12 })
  mocks.metadata
    .mockReset()
    .mockResolvedValue({ stats: { projects: 1, active: 1, dev: 0, archived: 0, tags: 0 }, tags: [] })
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
async function setup() {
  let state!: Awaited<ReturnType<typeof useProjects>>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        async setup() {
          clearNuxtData(['projects-feed', 'projects-metadata'])
          state = await useProjects()
          return () => h('div')
        },
      }),
      { route: '/projects' },
    ),
  )
  return state
}
it('读取失败不伪造空列表或零统计，重试恢复真实结果', async () => {
  const state = await setup()
  mocks.list.mockRejectedValueOnce(new Error('项目暂不可用'))
  await state.refresh()
  expect(state.error.value?.message).toBe('项目暂不可用')
  expect(state.projects.value).toHaveLength(1)
  expect(state.total.value).toBe(1)
  mocks.list.mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 12 })
  await state.refresh()
  expect(state.total.value).toBe(0)
  expect(state.error.value).toBeUndefined()
})
it('快速切换进展和技术标签，迟到列表不回滚最新筛选', async () => {
  const state = await setup()
  let finish!: (value: unknown) => void
  mocks.list.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  await state.changeQuery({ progress: 'dev' })
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  mocks.list.mockResolvedValueOnce({ items: [{ ...project, id: 2, title: '新项目' }], total: 1, page: 1, pageSize: 12 })
  await state.changeQuery({ progress: 'active', tag: 'Vue' })
  await vi.waitFor(() =>
    expect(
      state.projects.value[0]?.id,
      JSON.stringify({ query: state.query.value, calls: mocks.list.mock.calls.map((call) => call[0]) }),
    ).toBe(2),
  )
  finish({ items: [project], total: 1, page: 1, pageSize: 12 })
  await Promise.resolve()
  expect(state.projects.value[0]?.id).toBe(2)
  expect(state.query.value.tag).toBe('Vue')
})
it('SSR第2页与已后退到第1页的路由冲突时，首帧仍用SSR卡片且挂载后才读取第1页', async () => {
  let state!: Awaited<ReturnType<typeof useProjects>>
  let app!: ReturnType<typeof useNuxtApp>
  let priorHydrating = false,
    priorServerRendered: boolean | undefined
  const frames: { ready: boolean; page: number; ids: number[] }[] = []
  const requests: { page: number; mounted: boolean; hydrating: boolean }[] = []
  let mounted = false
  const serverItem = { ...project, id: 22, title: 'SSR第2页项目' }
  mocks.list.mockImplementation(async (query: { page: number }) => {
    requests.push({ page: query.page, mounted, hydrating: app.isHydrating })
    return { items: [project], total: 13, page: 1, pageSize: 12 }
  })
  try {
    const wrapper = await mountSuspended(
      defineComponent({
        async setup() {
          app = useNuxtApp()
          priorHydrating = app.isHydrating
          priorServerRendered = app.payload.serverRendered
          clearNuxtData(['projects-feed', 'projects-metadata'])
          app.isHydrating = true
          app.payload.serverRendered = true
          app.payload.data['projects-feed'] = {
            key: JSON.stringify({ page: 2, pageSize: 12 }),
            page: { items: [serverItem], total: 13, page: 2, pageSize: 12 },
          }
          app.payload.data['projects-metadata'] = {
            stats: { projects: 13, active: 13, dev: 0, archived: 0, tags: 0 },
            tags: [],
          }
          onMounted(() => {
            mounted = true
          })
          state = await useProjects()
          expect(app.isHydrating).toBe(true)
          expect(mocks.list).not.toHaveBeenCalled()
          return () => {
            frames.push({
              ready: state.ready.value,
              page: state.query.value.page,
              ids: state.projects.value.map((item) => item.id),
            })
            return h(
              'section',
              state.projects.value.map((item) => h('article', { 'data-project-id': item.id }, item.title)),
            )
          }
        },
      }),
      { route: '/projects?page=1' },
    )
    wrappers.push(wrapper)
    expect(frames[0]).toEqual({ ready: false, page: 2, ids: [22] })
    await vi.waitFor(() => expect(state.projects.value.map((item) => item.id)).toEqual([1]))
    expect(state.query.value.page).toBe(1)
    expect(requests).toEqual([{ page: 1, mounted: true, hydrating: true }])
    expect(wrapper.findAll('article').map((item) => item.attributes('data-project-id'))).toEqual(['1'])
    expect(app.payload.data['projects-feed'].key).toBe(JSON.stringify({ page: 1, pageSize: 12 }))
  } finally {
    if (app) {
      app.isHydrating = priorHydrating
      app.payload.serverRendered = priorServerRendered
    }
  }
})
