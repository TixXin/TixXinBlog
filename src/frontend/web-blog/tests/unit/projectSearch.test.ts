/** @file projectSearch.test.ts @description 全局搜索读取真实项目，稳定编号与分源错误不被本地演示结果掩盖 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useSearch } from '../../app/composables/useSearch'
const mocks = vi.hoisted(() => ({
  projects: vi.fn(),
  posts: vi.fn(),
  gallery: vi.fn(),
  moments: vi.fn(),
  flashes: vi.fn(),
}))
mockNuxtImport('useProjectRepository', () => () => ({ list: mocks.projects }))
mockNuxtImport('useLinkRepository', () => () => ({ list: async () => ({ items: [], total: 0 }) }))
mockNuxtImport('useGalleryRepository', () => () => ({ list: mocks.gallery }))
mockNuxtImport('useMomentRepository', () => () => ({ list: mocks.moments }))
mockNuxtImport('useFlashRepository', () => () => ({}))
vi.mock('../../app/features/post/api', () => ({ fetchPostPage: mocks.posts }))
vi.mock('../../app/features/search/flash', () => ({ fetchFlashSearchPage: mocks.flashes }))
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  mocks.projects
    .mockReset()
    .mockResolvedValue({ items: [{ id: 42, title: '共用关键词工作台', description: '协同记录' }], total: 1 })
  mocks.posts.mockReset().mockResolvedValue({
    items: [{ id: 5, slug: 'keyword-post', title: '共用关键词文章', summary: '文章介绍' }],
    total: 1,
  })
  for (const read of [mocks.gallery, mocks.moments, mocks.flashes])
    read.mockReset().mockResolvedValue({ items: [], total: 0 })
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
async function setup() {
  let state!: ReturnType<typeof useSearch>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          useRuntimeConfig().public.postUseMockRepo = false
          useRuntimeConfig().public.useMockRepo = false
          state = useSearch()
          return () => h('div')
        },
      }),
    ),
  )
  return state
}
it('项目结果使用 API 稳定编号，落到不依赖标题的项目详情 URL', async () => {
  const state = await setup()
  await state.search('共用关键词')
  expect(mocks.projects).toHaveBeenCalledWith({ q: '共用关键词', page: 1, pageSize: 3 }, expect.any(AbortSignal))
  expect(state.results.value.find((item) => item.type === 'project')).toMatchObject({
    id: '42',
    url: '/projects?project=42',
  })
})
it('项目服务失败明确报告该来源，文章成功结果仍可使用', async () => {
  const state = await setup()
  mocks.projects.mockRejectedValueOnce(new Error('断连'))
  await state.search('共用关键词')
  expect(state.error.value).toContain('项目搜索暂时不可用')
  expect(state.results.value.some((item) => item.type === 'post')).toBe(true)
  expect(state.results.value.some((item) => item.type === 'project')).toBe(false)
})
it('快速切换搜索会取消旧请求，迟到项目结果不覆盖当前关键词', async () => {
  const state = await setup()
  let finish!: (value: unknown) => void
  mocks.projects.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const earlier = state.search('旧关键词')
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  mocks.projects.mockResolvedValueOnce({ items: [{ id: 99, title: '新关键词工作台', description: '' }] })
  await state.search('新关键词')
  expect(mocks.projects.mock.calls[0]![1].aborted).toBe(true)
  finish({ items: [{ id: 42, title: '旧关键词工作台', description: '' }] })
  await earlier
  expect(state.query.value).toBe('新关键词')
  expect(state.results.value.find((item) => item.type === 'project')?.id).toBe('99')
})
it('输入新词后的防抖窗口里旧请求完成，不能解除新搜索的 pending', async () => {
  const state = await setup()
  await state.search('已有结果')
  const previous = [...state.results.value]
  let finish!: (value: unknown) => void
  mocks.projects.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const oldRequest = state.search('正在请求的旧词')
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  // 对应 SearchModal 的输入 watcher：新请求要等 250ms，版本号尚未增加。
  state.query.value = '刚输入的新词'
  state.isSearching.value = true
  finish({ items: [{ id: 77, title: '迟到旧结果', description: '' }] })
  await oldRequest
  expect(state.isSearching.value).toBe(true)
  expect(state.results.value).toEqual(previous)
  expect(state.query.value).toBe('刚输入的新词')
})

it('单类型仅查询目标来源并传递真实页码和总数，图库结果准确落到作品', async () => {
  const state = await setup()
  mocks.gallery.mockResolvedValue({ items: [{ id: 9, title: '海边', description: '傍晚的海岸' }], total: 25 })
  await state.search('海边', 'gallery', 2)
  expect(mocks.gallery).toHaveBeenCalledWith({ q: '海边', page: 2, pageSize: 10 }, expect.any(AbortSignal))
  expect(mocks.projects).not.toHaveBeenCalled()
  expect(mocks.posts).not.toHaveBeenCalled()
  expect(state.total.value).toBe(25)
  expect(state.page.value).toBe(2)
  expect(state.results.value[0]?.url).toBe('/gallery?photo=9')
})

it('朋友圈和闪念使用稳定详情路径，来源失败不报告为零项', async () => {
  const state = await setup()
  mocks.moments.mockResolvedValue({ items: [{ id: 'moment-a', content: '周末阅读' }], total: 12 })
  mocks.flashes.mockResolvedValue({ items: [{ id: 'flash-a', content: '读书思考' }], total: 4 })
  mocks.gallery.mockRejectedValue(new Error('断连'))
  await state.search('阅读')
  expect(state.groups.value.find((group) => group.type === 'gallery')).toMatchObject({ total: null, unavailable: true })
  expect(state.total.value).toBeNull()
  expect(state.results.value.find((item) => item.type === 'moment')?.url).toBe('/moments/moment-a')
  expect(state.results.value.find((item) => item.type === 'flash')?.url).toBe('/flash/flash-a')
})

it('类型快切取消旧类型，迟到响应不恢复旧页码', async () => {
  const state = await setup()
  let finish!: (value: unknown) => void
  mocks.gallery.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const old = state.search('阅读', 'gallery', 2)
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  await state.search('阅读', 'project', 1)
  expect(mocks.gallery.mock.calls[0]![1].aborted).toBe(true)
  finish({ items: [], total: 55 })
  await old
  expect(state.type.value).toBe('project')
  expect(state.page.value).toBe(1)
  expect(state.total.value).toBe(1)
})
