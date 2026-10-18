/** @file articleInteraction.test.ts @description 文章浏览计数与点赞的挂载读取、失败回退、请求互斥及统计缓存同步。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import type { Ref } from 'vue'
import type { NuxtApp } from '#app'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { useArticleInteraction } from '../../app/composables/useArticleInteraction'
import type { PostSummary } from '../../app/features/post/types'
import type { PostViewResult } from '../../app/features/post/api'
import { publicReadCache } from '../../app/utils/publicReadCache'

const mocks = vi.hoisted(() => ({
  view: vi.fn(),
  interaction: vi.fn(),
  like: vi.fn(),
}))
vi.mock('../../app/features/post/api', () => ({
  recordPostView: mocks.view,
  fetchPostInteraction: mocks.interaction,
  togglePostLike: mocks.like,
}))

function summary(): PostSummary {
  return { tags: [], categories: [], stats: { posts: 3, views: 100, comments: 5, tags: 2, siteAgeDays: 30 } }
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
  mocks.view.mockReset().mockResolvedValue({ views: 21, likes: 4, liked: true, counted: true })
  mocks.interaction.mockReset().mockResolvedValue({ views: 20, likes: 3, liked: false })
  mocks.like.mockReset().mockResolvedValue({ likes: 5, liked: false })
})
afterEach(async () => {
  cleanup
    .splice(0)
    .reverse()
    .forEach((dispose) => dispose())
  await flushPromises()
})
async function setup(metadata: PostSummary | null = summary()) {
  let state!: ReturnType<typeof useArticleInteraction>
  let app!: NuxtApp
  let siteSummary!: Ref<PostSummary | undefined>
  let previous: PostSummary | undefined
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        app = useNuxtApp()
        siteSummary = useNuxtData<PostSummary>('post-metadata').data
        previous = siteSummary.value
        siteSummary.value = metadata ?? undefined
        state = useArticleInteraction('7', { views: 10, likes: 2 })
        // 互动请求必须留在挂载阶段，不能在 SSR/setup 阶段写入浏览计数。
        expect(mocks.view).not.toHaveBeenCalled()
        return () => h('div')
      },
    }),
  )
  cleanup.push(() => {
    wrapper.unmount()
    siteSummary.value = previous
  })
  await flushPromises()
  return { state, app, siteSummary }
}

describe('文章互动', () => {
  it('挂载只请求一次计数并恢复点赞状态，已计入浏览时替换浅响应式全站统计', async () => {
    const metadata = summary()
    const { state, siteSummary } = await setup(metadata)
    expect(mocks.view).toHaveBeenCalledExactlyOnceWith('/api/v1', '7')
    expect(mocks.interaction).not.toHaveBeenCalled()
    expect(state.loaded.value).toBe(true)
    expect(state.pending.value).toBe(false)
    expect(state.error.value).toBe('')
    expect([state.views.value, state.likes.value, state.liked.value]).toEqual([21, 4, true])
    expect(siteSummary.value?.stats.views).toBe(101)
    expect(siteSummary.value).not.toBe(metadata)
    expect(metadata.stats.views).toBe(100)
    expect(siteSummary.value?.stats.comments).toBe(5)
  })

  it('小时内重复浏览不增加全站统计，缺少统计缓存也不妨碍互动恢复', async () => {
    mocks.view.mockResolvedValue({ views: 20, likes: 4, liked: false, counted: false })
    const first = await setup()
    expect(first.siteSummary.value?.stats.views).toBe(100)
    mocks.view.mockClear()
    mocks.view.mockResolvedValue({ views: 21, likes: 4, liked: false, counted: true })
    const second = await setup(null)
    expect(second.state.loaded.value).toBe(true)
    expect(second.state.views.value).toBe(21)
    expect(second.siteSummary.value).toBeUndefined()
  })

  it('计数失败后读取互动状态，提示计数未同步且不补加全站浏览量', async () => {
    mocks.view.mockRejectedValueOnce(new Error('计数服务暂不可用'))
    const { state, siteSummary } = await setup()
    expect(mocks.interaction).toHaveBeenCalledExactlyOnceWith('/api/v1', '7')
    expect(state.loaded.value).toBe(true)
    expect(state.error.value).toBe('浏览计数暂未同步，可以重试')
    expect([state.views.value, state.likes.value, state.liked.value]).toEqual([20, 3, false])
    expect(siteSummary.value?.stats.views).toBe(100)
  })

  it('计数与互动读取均失败时保留初始值并禁用点赞，手动重试可恢复', async () => {
    mocks.view.mockRejectedValueOnce(new Error('计数失败'))
    mocks.interaction.mockRejectedValueOnce(new Error('互动读取失败'))
    const { state } = await setup()
    expect(state.loaded.value).toBe(false)
    expect(state.pending.value).toBe(false)
    expect([state.views.value, state.likes.value]).toEqual([10, 2])
    expect(state.error.value).toBe('文章互动状态加载失败，请重试')
    await state.toggle()
    expect(mocks.like).not.toHaveBeenCalled()
    await state.load()
    expect(state.loaded.value).toBe(true)
    expect(state.error.value).toBe('')
    expect(state.views.value).toBe(21)
  })

  it('初始读取未完成时互斥重读与点赞，不提前修改初始计数', async () => {
    const pending = deferred<PostViewResult>()
    mocks.view.mockReturnValueOnce(pending.promise)
    const { state } = await setup()
    expect(state.pending.value).toBe(true)
    await state.load()
    await state.toggle()
    expect(mocks.view).toHaveBeenCalledOnce()
    expect(mocks.like).not.toHaveBeenCalled()
    expect([state.views.value, state.likes.value]).toEqual([10, 2])
    pending.resolve({ views: 31, likes: 8, liked: true, counted: false })
    await flushPromises()
    expect(state.loaded.value).toBe(true)
    expect(state.pending.value).toBe(false)
    expect([state.views.value, state.likes.value, state.liked.value]).toEqual([31, 8, true])
  })

  it('点赞以服务端结果为准，连续点击只写一次，成功后撤销文章与统计缓存', async () => {
    const { state, app } = await setup()
    const cache = publicReadCache(app)
    cache.put('posts', 'interaction-posts', { likes: 4 }, cache.generation('posts'), 30_000)
    cache.put('post-summary', 'interaction-summary', summary(), cache.generation('post-summary'), 30_000)
    cache.put('gallery', 'interaction-gallery', { total: 1 }, cache.generation('gallery'), 30_000)
    const pending = deferred<{ liked: boolean; likes: number }>()
    mocks.like.mockReturnValueOnce(pending.promise)
    const toggling = state.toggle()
    await state.toggle()
    await state.load()
    expect(mocks.like).toHaveBeenCalledExactlyOnceWith('/api/v1', '7')
    expect(mocks.view).toHaveBeenCalledOnce()
    expect([state.likes.value, state.liked.value]).toEqual([4, true])
    expect(cache.read('interaction-posts')).toBeDefined()
    pending.resolve({ liked: false, likes: 9 })
    await toggling
    expect([state.likes.value, state.liked.value]).toEqual([9, false])
    expect(state.pending.value).toBe(false)
    expect(cache.read('interaction-posts')).toBeUndefined()
    expect(cache.read('interaction-summary')).toBeUndefined()
    expect(cache.read('interaction-gallery')).toBeDefined()
  })

  it('点赞失败不伪造计数变化或撤销缓存，显式重试后清除错误', async () => {
    const { state, app } = await setup()
    const cache = publicReadCache(app)
    cache.put('posts', 'failed-like-posts', { likes: 4 }, cache.generation('posts'), 30_000)
    mocks.like.mockRejectedValueOnce(new Error('连接中断'))
    await state.toggle()
    expect([state.likes.value, state.liked.value]).toEqual([4, true])
    expect(state.pending.value).toBe(false)
    expect(state.error.value).toBe('点赞操作失败，请重试同步状态')
    expect(cache.read('failed-like-posts')).toBeDefined()
    await state.toggle()
    expect([state.likes.value, state.liked.value]).toEqual([5, false])
    expect(state.error.value).toBe('')
  })

  it('显式演示模式只修改本地点赞，挂载和手动读取均不调用真实 API', async () => {
    config.public.postUseMockRepo = true
    const { state, siteSummary } = await setup()
    expect(state.loaded.value).toBe(true)
    await state.load()
    await state.toggle()
    expect([state.likes.value, state.liked.value]).toEqual([3, true])
    await state.toggle()
    expect([state.likes.value, state.liked.value]).toEqual([2, false])
    expect(mocks.view).not.toHaveBeenCalled()
    expect(mocks.interaction).not.toHaveBeenCalled()
    expect(mocks.like).not.toHaveBeenCalled()
    expect(siteSummary.value?.stats.views).toBe(100)
  })
})
