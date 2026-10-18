/** @file articleDetail.test.ts @description 文章详情的并行读取、地址解析、失败降级与应用内快照复用。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { useArticleDetail } from '../../app/composables/useArticleDetail'
import type { ArticleDetail, RelatedPost, TocItem } from '../../app/features/post/types'
import { isPageRequestCancellation } from '../../app/utils/pageRequestCancellation'

const mocks = vi.hoisted(() => ({
  detail: vi.fn(),
  related: vi.fn(),
  navigation: vi.fn(),
}))
vi.mock('../../app/features/post/api', () => ({
  fetchArticleDetail: mocks.detail,
  fetchRelatedPosts: mocks.related,
  fetchPostNavigation: mocks.navigation,
}))

type Detail = ArticleDetail & { toc: TocItem[] }
type State = Awaited<ReturnType<typeof useArticleDetail>>
const related: RelatedPost = { id: '8', title: '山间散步', date: '2026-10-17', category: '生活' }
function article(overrides: Partial<Detail> = {}): Detail {
  return {
    id: '7',
    title: '秋日记录',
    cover: '',
    date: '2026-10-18',
    category: '生活',
    readTime: '3 分钟',
    views: 12,
    likes: 2,
    comments: 1,
    summary: '散步途中看到的秋色',
    contentRaw: '# 秋日记录\n\n## 河畔',
    toc: [
      { id: 'heading-1', text: '秋日记录', level: 1 },
      { id: 'heading-2', text: '河畔', level: 2 },
    ],
    ...overrides,
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const cleanup: (() => void)[] = []
let config: ReturnType<typeof useRuntimeConfig>
beforeEach(() => {
  // 保留 Nuxt 路由初始化所需配置，只临时覆盖文章读取开关与 API 基址。
  config = useRuntimeConfig()
  const previous = { postUseMockRepo: config.public.postUseMockRepo, apiBaseUrl: config.public.apiBaseUrl }
  cleanup.push(() => Object.assign(config.public, previous))
  config.public.postUseMockRepo = false
  config.public.apiBaseUrl = '/api/v1'
  mocks.detail.mockReset().mockResolvedValue(article())
  mocks.related.mockReset().mockResolvedValue([related])
  mocks.navigation.mockReset().mockResolvedValue({ prev: related, next: null })
})
afterEach(async () => {
  cleanup
    .splice(0)
    .reverse()
    .forEach((dispose) => dispose())
  await flushPromises()
})
async function setup(id = '7', options: { reuseLoaded?: boolean } = {}) {
  let result!: Promise<{ state?: State; error?: unknown }>
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        clearNuxtData(`article-snapshot-${id}`)
        // 独立保存结果，允许在初始请求尚未完成时卸载页面，核验真实作用域取消。
        result = useArticleDetail(id, options).then(
          (state) => ({ state }),
          (error: unknown) => ({ error }),
        )
        return () => h('div')
      },
    }),
  )
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    wrapper.unmount()
  }
  cleanup.push(dispose)
  return { result, dispose }
}
async function load(id = '7', options: { reuseLoaded?: boolean } = {}) {
  const view = await setup(id, options)
  const result = await view.result
  expect(result.error).toBeUndefined()
  return { ...view, state: result.state! }
}

describe('文章详情读取', () => {
  it('数字地址同时读取详情和推荐，相邻文章按详情专栏读取，并按正文规则过滤重复标题', async () => {
    const pending = deferred<Detail>()
    mocks.detail.mockReturnValueOnce(pending.promise)
    const view = await setup()
    expect(mocks.detail).toHaveBeenCalledWith('/api/v1', '7', expect.any(AbortSignal))
    expect(mocks.related).toHaveBeenCalledWith('/api/v1', '7', expect.any(AbortSignal))
    // 上下篇优先同专栏，需等详情确定专栏后再读取。
    expect(mocks.navigation).not.toHaveBeenCalled()
    pending.resolve(article())
    const { state } = await view.result
    expect(mocks.navigation).toHaveBeenCalledWith('/api/v1', '7', expect.any(AbortSignal), 'folder')
    expect(state!.article.value.id).toBe('7')
    expect(state!.relatedPosts.value).toEqual([related])
    expect(state!.navigation.value).toEqual({ prev: related, next: null })
    expect(state!.navigationFolder.value).toBe('生活')
    expect(state!.tocItems.value).toEqual([{ id: 'heading-2', text: '河畔', level: 2 }])
    expect(state!.discoveryError.value).toBe(false)
  })

  it('自定义地址等待详情解析，再使用真实文章编号读取补充内容', async () => {
    const pending = deferred<Detail>()
    mocks.detail.mockReturnValueOnce(pending.promise)
    const view = await setup('autumn-walk')
    expect(mocks.related).not.toHaveBeenCalled()
    expect(mocks.navigation).not.toHaveBeenCalled()
    pending.resolve(article({ id: '42' }))
    const { state } = await view.result
    expect(state!.article.value.id).toBe('42')
    expect(mocks.related).toHaveBeenCalledWith('/api/v1', '42', expect.any(AbortSignal))
    expect(mocks.navigation).toHaveBeenCalledWith('/api/v1', '42', expect.any(AbortSignal), 'folder')
  })

  it.each(['related', 'navigation'] as const)('%s 失败仍展示真实详情及另一项补充结果', async (failed) => {
    mocks[failed].mockRejectedValueOnce(new Error('补充读取暂不可用'))
    const { state } = await load()
    expect(state.article.value.title).toBe('秋日记录')
    expect(state.discoveryError.value).toBe(true)
    expect(state.relatedPosts.value).toEqual(failed === 'related' ? [] : [related])
    expect(state.navigation.value).toEqual({ prev: failed === 'navigation' ? null : related, next: null })
  })

  it.each([404, 500])('详情返回 %s 时保留缺失或服务失败语义，并取消补充读取', async (statusCode) => {
    mocks.detail.mockRejectedValueOnce({ statusCode })
    const view = await setup()
    const { error, state } = await view.result
    expect(state).toBeUndefined()
    expect(error).toMatchObject({ statusCode: statusCode === 404 ? 404 : 503, fatal: true })
    expect((mocks.related.mock.calls[0]![2] as AbortSignal).aborted).toBe(true)
    // 相邻文章依赖详情确定的专栏，详情失败时不会发起。
    expect(mocks.navigation).not.toHaveBeenCalled()
  })

  it('页面销毁撤销详情与补充读取，迟到结果不能完成页面初始化', async () => {
    const pending = deferred<Detail>()
    mocks.detail.mockReturnValueOnce(pending.promise)
    const view = await setup()
    const signal = mocks.detail.mock.calls[0]![2] as AbortSignal
    view.dispose()
    expect(signal.aborted).toBe(true)
    pending.resolve(article({ title: '已经离开的页面' }))
    const result = await view.result
    expect(result.state).toBeUndefined()
    expect(isPageRequestCancellation(result.error)).toBe(true)
  })

  it.each([
    { summary: '优先摘要', excerpt: '后端摘录', content: [], expected: '优先摘要' },
    { summary: '', excerpt: '后端摘录', content: [], expected: '后端摘录' },
    {
      summary: '',
      excerpt: '',
      content: [{ type: 'paragraph' as const, text: '秋'.repeat(180) }],
      expected: '秋'.repeat(160),
    },
    { summary: '', excerpt: '', content: [], expected: '阅读本站的文章' },
  ])('摘要按摘要、后端摘录、旧正文与默认文案顺序兜底：$expected', async ({ expected, ...data }) => {
    mocks.detail.mockResolvedValueOnce(article(data))
    const { state } = await load()
    expect(state.articleExcerpt.value).toBe(expected)
  })

  it('同一应用仅按相同地址和 API 基址复用最后详情，基址或文章变化会重新读取', async () => {
    const first = await load()
    const firstArticle = first.state.article.value
    first.dispose()
    const reused = await load('7', { reuseLoaded: true })
    expect(reused.state.article.value).toEqual(firstArticle)
    expect(mocks.detail).toHaveBeenCalledTimes(1)
    config.public.apiBaseUrl = '/next-api/v1'
    mocks.detail.mockResolvedValue(article({ title: '新数据源' }))
    const changedBase = await load('7', { reuseLoaded: true })
    expect(changedBase.state.article.value.title).toBe('新数据源')
    expect(mocks.detail).toHaveBeenCalledTimes(2)
    mocks.detail.mockResolvedValue(article({ id: '9' }))
    const changedId = await load('9', { reuseLoaded: true })
    expect(changedId.state.article.value.id).toBe('9')
    expect(mocks.detail).toHaveBeenCalledTimes(3)
  })
})
