/** @file articleRequestFeedback.test.ts @description 文章补充读取与互动失败后的重试、缓存复用和卸载归属回归 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { useArticleDetail } from '../../app/composables/useArticleDetail'
import { useArticleInteraction } from '../../app/composables/useArticleInteraction'
import { mockArticleDetail } from '../../app/features/post/mock'
import type { RelatedPost } from '../../app/features/post/types'

const mocks = vi.hoisted(() => ({
  detail: vi.fn(),
  related: vi.fn(),
  navigation: vi.fn(),
  view: vi.fn(),
  interaction: vi.fn(),
  like: vi.fn(),
}))
vi.mock('~/features/post/api', () => ({
  fetchArticleDetail: mocks.detail,
  fetchRelatedPosts: mocks.related,
  fetchPostNavigation: mocks.navigation,
  recordPostView: mocks.view,
  fetchPostInteraction: mocks.interaction,
  togglePostLike: mocks.like,
}))
const wrappers: { unmount(): void }[] = []
const related: RelatedPost = { id: '42', title: '窗边的光', category: '生活', date: '2026-10-18' }
let nextId = 7000
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
beforeEach(() => {
  useRuntimeConfig().public.postUseMockRepo = false
  useRuntimeConfig().public.apiBaseUrl = '/api/v1'
  Object.values(mocks).forEach((mock) => mock.mockReset())
  mocks.detail.mockImplementation(async (_base: string, id: string) => ({
    ...mockArticleDetail,
    id: id === 'slug' ? '42' : id,
  }))
  mocks.related.mockResolvedValue([related])
  mocks.navigation.mockResolvedValue({ prev: related, next: null })
  mocks.view.mockResolvedValue({ likes: 3, views: 12, liked: false, counted: false })
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
async function setupDetail(id = String(++nextId), reuseLoaded = false) {
  let state!: Awaited<ReturnType<typeof useArticleDetail>>
  const wrapper = await mountSuspended(
    defineComponent({
      async setup() {
        state = await useArticleDetail(id, { reuseLoaded })
        return () => h('p', state.article.value.title)
      },
    }),
  )
  wrappers.push(wrapper)
  return { state, wrapper, id }
}

describe('文章补充读取失败反馈', () => {
  it('相关推荐失败不丢失正文和相邻文章，重试只重读补充信息并恢复反馈', async () => {
    mocks.related.mockRejectedValueOnce(new Error('offline'))
    const { state } = await setupDetail()
    expect(state.discoveryError.value).toBe(true)
    expect(state.relatedPosts.value).toEqual([])
    expect(state.navigation.value.prev).toEqual(related)
    const article = state.article.value
    await state.retryDiscovery()
    expect(state.discoveryError.value).toBe(false)
    expect(state.relatedPosts.value).toEqual([related])
    expect(state.article.value).toBe(article)
    expect(mocks.detail).toHaveBeenCalledTimes(1)
    expect(mocks.related).toHaveBeenCalledTimes(2)
    expect(mocks.navigation).toHaveBeenCalledTimes(2)
  })

  it('重复点击只发一次补充读取，部分重试失败保留已知内容', async () => {
    const { state } = await setupDetail()
    const pending = deferred<RelatedPost[]>()
    mocks.related.mockReturnValueOnce(pending.promise)
    mocks.navigation.mockRejectedValueOnce(new Error('offline'))
    const first = state.retryDiscovery()
    expect(state.discoveryPending.value).toBe(true)
    await state.retryDiscovery()
    expect(mocks.related).toHaveBeenCalledTimes(2)
    pending.resolve([{ ...related, title: '新的推荐' }])
    await first
    expect(state.discoveryPending.value).toBe(false)
    expect(state.discoveryError.value).toBe(true)
    expect(state.navigation.value.prev).toEqual(related)
    expect(state.relatedPosts.value[0]?.title).toBe('新的推荐')
  })

  it('主题切换复用文章后仍可重试，恢复结果写回同一文章快照', async () => {
    mocks.related.mockRejectedValueOnce(new Error('offline'))
    const first = await setupDetail()
    first.wrapper.unmount()
    const reused = await setupDetail(first.id, true)
    expect(reused.state.discoveryError.value).toBe(true)
    expect(mocks.detail).toHaveBeenCalledTimes(1)
    await reused.state.retryDiscovery()
    reused.wrapper.unmount()
    const restored = await setupDetail(first.id, true)
    expect(restored.state.discoveryError.value).toBe(false)
    expect(restored.state.relatedPosts.value).toEqual([related])
    expect(mocks.detail).toHaveBeenCalledTimes(1)
  })

  it('补充读取的迟到结果不会在页面卸载后更新快照', async () => {
    mocks.related.mockRejectedValueOnce(new Error('offline'))
    const first = await setupDetail()
    const pending = deferred<RelatedPost[]>()
    mocks.related.mockReturnValueOnce(pending.promise)
    const retry = first.state.retryDiscovery()
    const signal = mocks.related.mock.lastCall![2] as AbortSignal
    first.wrapper.unmount()
    expect(signal.aborted).toBe(true)
    pending.resolve([related])
    await retry
    const reused = await setupDetail(first.id, true)
    expect(reused.state.discoveryError.value).toBe(true)
    expect(reused.state.relatedPosts.value).toEqual([])
  })

  it('自定义文章地址重试使用解析后的数字文章编号', async () => {
    mocks.related.mockRejectedValueOnce(new Error('offline'))
    const { state } = await setupDetail('slug')
    await state.retryDiscovery()
    expect(mocks.related).toHaveBeenLastCalledWith('/api/v1', '42', expect.any(AbortSignal))
    expect(mocks.navigation).toHaveBeenLastCalledWith('/api/v1', '42', expect.any(AbortSignal), 'auto')
  })

  it('相邻文章重试沿用专栏范围，按回退结果刷新专栏标注并写回复用快照', async () => {
    mocks.navigation.mockRejectedValueOnce(new Error('offline'))
    const first = await setupDetail()
    expect(first.state.discoveryError.value).toBe(true)
    expect(first.state.navigationFolder.value).toBeNull()
    mocks.navigation.mockResolvedValueOnce({ prev: related, next: null, fallback: false })
    await first.state.retryDiscovery()
    expect(mocks.navigation).toHaveBeenLastCalledWith('/api/v1', first.id, expect.any(AbortSignal), 'auto')
    expect(first.state.discoveryError.value).toBe(false)
    expect(first.state.navigationFolder.value).toBe('前端架构')
    expect(first.state.navigation.value).toEqual({ prev: related, next: null })
    first.wrapper.unmount()

    const reused = await setupDetail(first.id, true)
    expect(reused.state.navigationFolder.value).toBe('前端架构')
    mocks.navigation.mockResolvedValueOnce({ prev: null, next: related, fallback: true })
    await reused.state.retryDiscovery()
    expect(reused.state.navigationFolder.value).toBeNull()
    expect(reused.state.navigation.value).toEqual({ prev: null, next: related })
    reused.wrapper.unmount()

    const restored = await setupDetail(first.id, true)
    expect(restored.state.navigationFolder.value).toBeNull()
    expect(restored.state.navigation.value).toEqual({ prev: null, next: related })
    expect(mocks.detail).toHaveBeenCalledTimes(1)
  })
})

describe('文章互动状态读取', () => {
  it('失败重试期间保留反馈，成功同步后清除错误且不自动重放点赞', async () => {
    mocks.view.mockRejectedValueOnce(new Error('offline'))
    mocks.interaction.mockRejectedValueOnce(new Error('offline'))
    let state!: ReturnType<typeof useArticleInteraction>
    const wrapper = await mountSuspended(
      defineComponent({
        setup() {
          state = useArticleInteraction('42', { likes: 2, views: 10 })
          return () => h('p', state.error.value)
        },
      }),
    )
    wrappers.push(wrapper)
    await flushPromises()
    expect(state.error.value).toBe('文章互动状态加载失败，请重试')
    const pending = deferred<{ likes: number; views: number; liked: boolean; counted: boolean }>()
    mocks.view.mockReturnValueOnce(pending.promise)
    const retry = state.load()
    expect(state.pending.value).toBe(true)
    expect(state.error.value).toContain('加载失败')
    await state.load()
    expect(mocks.view).toHaveBeenCalledTimes(2)
    pending.resolve({ likes: 3, views: 12, liked: true, counted: false })
    await retry
    expect(state.error.value).toBe('')
    expect(state.pending.value).toBe(false)
    expect(state.loaded.value).toBe(true)
    expect(state.liked.value).toBe(true)
    expect(mocks.like).not.toHaveBeenCalled()
  })
})
