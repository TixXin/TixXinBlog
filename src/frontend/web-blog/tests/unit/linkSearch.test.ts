/** @file linkSearch.test.ts @description 全局搜索使用稳定友链编号，同域不同路径不碰撞且失败分源说明 */
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useSearch } from '../../app/composables/useSearch'
const mocks = vi.hoisted(() => ({
  links: vi.fn(),
  projects: vi.fn(),
  posts: vi.fn(),
  gallery: vi.fn(),
  moments: vi.fn(),
  flashes: vi.fn(),
}))
mockNuxtImport('useLinkRepository', () => () => ({ list: mocks.links }))
mockNuxtImport('useProjectRepository', () => () => ({ list: mocks.projects }))
mockNuxtImport('useGalleryRepository', () => () => ({ list: mocks.gallery }))
mockNuxtImport('useMomentRepository', () => () => ({ list: mocks.moments }))
mockNuxtImport('useFlashRepository', () => () => ({}))
vi.mock('../../app/features/post/api', () => ({ fetchPostPage: mocks.posts }))
vi.mock('../../app/features/search/flash', () => ({ fetchFlashSearchPage: mocks.flashes }))
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  mocks.links.mockReset().mockResolvedValue({
    items: [
      { id: 1, name: '文档', description: 'A', url: 'https://example.com/Docs/' },
      { id: 2, name: '文档', description: 'B', url: 'https://example.com/docs?x=2&x=1' },
    ],
    total: 2,
  })
  mocks.projects.mockReset().mockResolvedValue({ items: [{ id: 8, title: '文档工作台', description: '' }], total: 1 })
  mocks.posts.mockReset().mockResolvedValue({ items: [], total: 0 })
  mocks.gallery
    .mockReset()
    .mockResolvedValue({ items: [{ id: 9, title: '文档配图', description: '图片说明' }], total: 1 })
  mocks.moments.mockReset().mockResolvedValue({ items: [{ id: 'moment-doc', content: '整理文档' }], total: 1 })
  mocks.flashes.mockReset().mockResolvedValue({ items: [{ id: 'flash-doc', content: '文档阅读笔记' }], total: 1 })
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
it('真实友链以id区分相同名称和域名，保留地址语义', async () => {
  const state = await setup()
  await state.search('文档')
  expect(state.results.value.filter((item) => item.type === 'link').map((item) => [item.id, item.url])).toEqual([
    ['1', 'https://example.com/Docs/'],
    ['2', 'https://example.com/docs?x=2&x=1'],
  ])
  expect(mocks.links).toHaveBeenCalledWith({ q: '文档', page: 1, pageSize: 3 }, expect.any(AbortSignal))
})
it('友链搜索失败不拿mock补齐，其他成功来源仍有可用结果', async () => {
  const state = await setup()
  mocks.links.mockRejectedValueOnce(new Error('unavailable'))
  await state.search('文档')
  expect(state.error.value).toContain('友链搜索暂时不可用')
  expect(state.results.value.some((item) => item.type === 'link')).toBe(false)
  expect(state.results.value.some((item) => item.type === 'project')).toBe(true)
  for (const type of ['gallery', 'moment', 'flash'])
    expect(state.results.value.some((item) => item.type === type)).toBe(true)
})
