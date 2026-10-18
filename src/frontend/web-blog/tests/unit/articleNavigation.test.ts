/** @file articleNavigation.test.ts @description 同专栏导航选择、回退、详情解析、错误与主题切换快照复用 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { useArticleDetail } from '../../app/composables/useArticleDetail'
import { fetchArticleDetail, fetchPostNavigation, fetchRelatedPosts } from '../../app/features/post/api'
import type { ArticleDetail, PostNavigation, RelatedPost, TocItem } from '../../app/features/post/types'

vi.mock('../../app/features/post/api', () => ({
  fetchArticleDetail: vi.fn(),
  fetchPostNavigation: vi.fn(),
  fetchRelatedPosts: vi.fn(),
}))
vi.mock('../../app/features/post/mock', () => ({
  mockArticleDetail: { content: [], readTime: '1 分钟', views: 0, likes: 0, comments: 0 },
  mockTocItems: [],
  mockPosts: [
    { id: 4, title: '四月', date: '2026-04-01', folder: '随笔', tags: [] },
    { id: 3, title: '三月', date: '2026-03-01', folder: '前端', tags: [] },
    { id: 2, title: '二月', date: '2026-02-01', folder: '随笔', tags: [] },
    { id: 1, title: '一月', date: '2026-01-01', folder: '', tags: [] },
  ],
}))

const detail: ArticleDetail & { toc: TocItem[] } = {
  id: '9',
  slug: 'reading-notes',
  title: '阅读笔记',
  category: '前端开发',
  cover: '',
  date: '2026-10-01',
  readTime: '1 分钟',
  views: 0,
  likes: 0,
  comments: 0,
  content: [],
  toc: [],
}
const previous: RelatedPost = { id: '10', title: '继续阅读', category: '前端开发', date: '2026-10-02' }
const next: RelatedPost = { id: '8', title: '初读', category: '前端开发', date: '2026-09-30' }
const globalNavigation: PostNavigation = { prev: { ...previous, id: '20', category: '随笔' }, next: null }
const wrappers: { unmount(): void }[] = []
let config: ReturnType<typeof useRuntimeConfig> | undefined
let originalConfig: { apiBaseUrl: string; postUseMockRepo: boolean } | undefined

beforeEach(() => {
  clearNuxtData((key) => key.startsWith('article-snapshot-'))
  vi.mocked(fetchArticleDetail).mockReset().mockResolvedValue(detail)
  vi.mocked(fetchRelatedPosts).mockReset().mockResolvedValue([])
  vi.mocked(fetchPostNavigation).mockReset().mockResolvedValue({ prev: previous, next })
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  if (config && originalConfig) Object.assign(config.public, originalConfig)
  originalConfig = undefined
})

async function setup(id = '9', options: { reuseLoaded?: boolean; mock?: boolean; base?: string } = {}) {
  let state: Awaited<ReturnType<typeof useArticleDetail>> | undefined
  let error: unknown
  wrappers.push(
    await mountSuspended(
      defineComponent({
        async setup() {
          config = useRuntimeConfig()
          originalConfig ??= {
            apiBaseUrl: config.public.apiBaseUrl,
            postUseMockRepo: config.public.postUseMockRepo,
          }
          config.public.apiBaseUrl = options.base ?? '/api/v1'
          config.public.postUseMockRepo = options.mock ?? false
          try {
            state = await useArticleDetail(id, options)
          } catch (caught) {
            error = caught
          }
          return () => h('div')
        },
      }),
    ),
  )
  return { state, error }
}

it('有专栏优先同专栏导航，保留专栏原名，不请求全站', async () => {
  vi.mocked(fetchArticleDetail).mockResolvedValue({ ...detail, category: ' 前端开发 ' })
  const { state, error } = await setup()
  expect(error).toBeUndefined()
  expect(state?.navigation.value).toEqual({ prev: previous, next })
  expect(state?.navigationFolder.value).toBe(' 前端开发 ')
  expect(state?.discoveryError.value).toBe(false)
  expect(fetchPostNavigation).toHaveBeenCalledExactlyOnceWith('/api/v1', '9', expect.any(AbortSignal), 'folder')
})

it.each([
  { prev: previous, next: null },
  { prev: null, next },
])('同专栏只有一侧 $prev / $next 时保留另一侧为空，不混入全站', async (navigation) => {
  vi.mocked(fetchPostNavigation).mockResolvedValue(navigation)
  const { state } = await setup()
  expect(state?.navigation.value).toEqual(navigation)
  expect(state?.navigationFolder.value).toBe('前端开发')
  expect(fetchPostNavigation).toHaveBeenCalledTimes(1)
})

it('同专栏双空时读取全站，回退结果不标注当前专栏，复用快照也不误标', async () => {
  vi.mocked(fetchPostNavigation)
    .mockResolvedValueOnce({ prev: null, next: null })
    .mockResolvedValueOnce(globalNavigation)
  const { state } = await setup()
  expect(state?.navigation.value).toEqual(globalNavigation)
  expect(state?.navigationFolder.value).toBeNull()
  expect(vi.mocked(fetchPostNavigation).mock.calls.map((call) => call[3] ?? 'all')).toEqual(['folder', 'all'])
  const { state: cached } = await setup('9', { reuseLoaded: true })
  expect(cached?.navigation.value).toEqual(globalNavigation)
  expect(cached?.navigationFolder.value).toBeNull()
  expect(fetchPostNavigation).toHaveBeenCalledTimes(2)
  expect(fetchArticleDetail).toHaveBeenCalledTimes(1)
})

it.each(['', '  '])('没有有效专栏（%s）时直接读取全站', async (category) => {
  vi.mocked(fetchArticleDetail).mockResolvedValue({ ...detail, category })
  vi.mocked(fetchPostNavigation).mockResolvedValue(globalNavigation)
  const { state } = await setup()
  expect(state?.navigation.value).toEqual(globalNavigation)
  expect(state?.navigationFolder.value).toBeNull()
  expect(fetchPostNavigation).toHaveBeenCalledExactlyOnceWith('/api/v1', '9', expect.any(AbortSignal))
})

it('专栏导航失败保留错误态，不请求全站或生成演示相邻文章', async () => {
  vi.mocked(fetchPostNavigation).mockRejectedValue(new Error('专栏导航不可用'))
  const { state, error } = await setup()
  expect(error).toBeUndefined()
  expect(state?.article.value.id).toBe('9')
  expect(state?.discoveryError.value).toBe(true)
  expect(state?.navigation.value).toEqual({ prev: null, next: null })
  expect(state?.navigationFolder.value).toBeNull()
  expect(fetchPostNavigation).toHaveBeenCalledTimes(1)
})

it('全站回退失败仍显示加载错误', async () => {
  vi.mocked(fetchPostNavigation)
    .mockResolvedValueOnce({ prev: null, next: null })
    .mockRejectedValueOnce(new Error('全站导航不可用'))
  const { state } = await setup()
  expect(state?.discoveryError.value).toBe(true)
  expect(state?.navigation.value).toEqual({ prev: null, next: null })
  expect(state?.navigationFolder.value).toBeNull()
})

it('数字 ID 的推荐与详情并行，导航等待详情确定范围；所有补充请求传递取消信号', async () => {
  let resolveDetail!: (value: typeof detail) => void
  vi.mocked(fetchArticleDetail).mockImplementationOnce(() => new Promise((resolve) => (resolveDetail = resolve)))
  const pending = setup()
  await vi.waitFor(() => expect(fetchRelatedPosts).toHaveBeenCalledTimes(1))
  expect(fetchPostNavigation).not.toHaveBeenCalled()
  resolveDetail(detail)
  await pending
  const relatedSignal = vi.mocked(fetchRelatedPosts).mock.calls[0]?.[2]
  expect(relatedSignal).toBeInstanceOf(AbortSignal)
  expect(vi.mocked(fetchPostNavigation).mock.calls[0]?.[2]).toBe(relatedSignal)
  expect(relatedSignal?.aborted).toBe(false)
  wrappers.pop()?.unmount()
  expect(relatedSignal?.aborted).toBe(true)
})

it('自定义地址的推荐与导航均使用详情解析后的真实 ID', async () => {
  const { state } = await setup('reading-notes')
  expect(state?.article.value.id).toBe('9')
  expect(fetchArticleDetail).toHaveBeenCalledWith('/api/v1', 'reading-notes', expect.any(AbortSignal))
  expect(fetchRelatedPosts).toHaveBeenCalledExactlyOnceWith('/api/v1', '9', expect.any(AbortSignal))
  expect(fetchPostNavigation).toHaveBeenCalledExactlyOnceWith('/api/v1', '9', expect.any(AbortSignal), 'folder')
})

it('主题切换复用当前文章时保留专栏，接口地址变化时重新读取', async () => {
  const { state: original } = await setup()
  const { state } = await setup('9', { reuseLoaded: true })
  expect(state?.navigationFolder.value).toBe('前端开发')
  expect(state?.navigation.value).toEqual({ prev: previous, next })
  expect(fetchPostNavigation).toHaveBeenCalledTimes(1)
  expect(fetchArticleDetail).toHaveBeenCalledTimes(1)
  const changedDetail = { ...detail, title: '新的阅读笔记', category: '新的专栏' }
  const changedNavigation = { prev: null, next: { ...next, category: '新的专栏' } }
  vi.mocked(fetchArticleDetail).mockResolvedValueOnce(changedDetail)
  vi.mocked(fetchPostNavigation).mockResolvedValueOnce(changedNavigation)
  const { state: changed } = await setup('9', { reuseLoaded: true, base: '/other-api' })
  expect(fetchPostNavigation).toHaveBeenCalledTimes(2)
  expect(fetchArticleDetail).toHaveBeenLastCalledWith('/other-api', '9', expect.any(AbortSignal))
  expect(fetchRelatedPosts).toHaveBeenLastCalledWith('/other-api', '9', expect.any(AbortSignal))
  expect(fetchPostNavigation).toHaveBeenLastCalledWith('/other-api', '9', expect.any(AbortSignal), 'folder')
  expect(changed?.article.value).toEqual(changedDetail)
  expect(changed?.navigation.value).toEqual(changedNavigation)
  expect(changed?.navigationFolder.value).toBe('新的专栏')
  expect(original?.article.value).toEqual(detail)
  expect(original?.navigation.value).toEqual({ prev: previous, next })
})

it('详情失败取消提前开始的推荐，不再发起导航且保留详情错误', async () => {
  vi.mocked(fetchArticleDetail).mockRejectedValueOnce({ statusCode: 404 })
  const { state, error } = await setup()
  expect(state).toBeUndefined()
  expect(error).toMatchObject({ statusCode: 404 })
  expect(vi.mocked(fetchRelatedPosts).mock.calls[0]?.[2]?.aborted).toBe(true)
  expect(fetchPostNavigation).not.toHaveBeenCalled()
})

it.each([
  { id: '4', prev: null, next: '2', folder: '随笔' },
  { id: '3', prev: '4', next: '2', folder: null },
  { id: '1', prev: '2', next: null, folder: null },
])('显式演示文章 $id 沿用同专栏优先及全站回退规则', async ({ id, prev, next, folder }) => {
  const { state, error } = await setup(id, { mock: true })
  expect(error).toBeUndefined()
  expect(state?.navigation.value.prev?.id ?? null).toBe(prev)
  expect(state?.navigation.value.next?.id ?? null).toBe(next)
  expect(state?.navigationFolder.value).toBe(folder)
  expect(fetchPostNavigation).not.toHaveBeenCalled()
  expect(fetchArticleDetail).not.toHaveBeenCalled()
})
