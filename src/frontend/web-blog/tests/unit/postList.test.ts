/**
 * @file postList.test.ts
 * @description 实际 Nuxt 数据源的模式切换、完整集合及筛选重置回归
 * @author TixXin
 * @since 2026-09-07
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { usePostList } from '../../app/composables/usePostList'
import { mockPosts } from '../../app/features/post/mock'
import { fetchPostPage } from '../../app/features/post/api'

// 只替换数据传输；不修改启动路由器也会使用的全局 runtimeConfig。
vi.mock('../../app/features/post/api', async () => {
  const { mockPosts: source } = await import('../../app/features/post/mock')
  return {
    fetchPostPage: vi.fn(async (_base, query) => {
      const filtered = source.filter(
        (post) =>
          (!query.tag || post.tags.some((tag) => tag.label === query.tag)) &&
          (!query.folder || post.folder === query.folder),
      )
      return {
        items: filtered.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
        total: filtered.length,
        page: query.page,
        pageSize: query.pageSize,
      }
    }),
  }
})

const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

async function setup(initialPage = 1, initialMode: 'waterfall' | 'pagination' = 'pagination') {
  const options = {
    page: ref(initialPage),
    selectedTag: ref<string | null>(null),
    selectedCategory: ref<string | null>(null),
    displayMode: ref<'waterfall' | 'pagination'>(initialMode),
  }
  let state!: Awaited<ReturnType<typeof usePostList>>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        async setup() {
          clearNuxtData('post-list')
          state = await usePostList(options)
          return () => h('div', String(state.posts.value.length))
        },
      }),
    ),
  )
  async function settle() {
    await nextTick()
    await flushPromises()
    await nextTick()
  }
  return { options, state, settle }
}

describe('文章数据源', () => {
  it('等待换页时保留原列表，后续页取消旧请求且迟到结果不能覆盖', async () => {
    const { options, state, settle } = await setup()
    let finishOld!: (value: Awaited<ReturnType<typeof fetchPostPage>>) => void
    let oldSignal: AbortSignal | undefined
    vi.mocked(fetchPostPage).mockImplementationOnce((_base, _query, signal) => {
      oldSignal = signal
      return new Promise((resolve) => {
        finishOld = resolve
      })
    })
    options.page.value = 2
    await settle()
    expect(state.pending.value).toBe(true)
    expect(state.posts.value.map((post) => post.id)).toEqual(mockPosts.slice(0, 15).map((post) => post.id))
    expect(oldSignal?.aborted).toBe(false)
    options.page.value = 3
    await settle()
    expect(oldSignal?.aborted).toBe(true)
    const expected = mockPosts.slice(30, 45).map((post) => post.id)
    await vi.waitFor(() => expect(state.posts.value.map((post) => post.id)).toEqual(expected))
    finishOld({ items: mockPosts.slice(15, 30), total: mockPosts.length, page: 2, pageSize: 15 })
    await settle()
    expect(state.posts.value.map((post) => post.id)).toEqual(expected)
  })

  it('新筛选失败时仍可阅读原列表，重试后替换为新分类', async () => {
    const { options, state, settle } = await setup()
    const original = state.posts.value.map((post) => post.id)
    vi.mocked(fetchPostPage).mockRejectedValueOnce(new Error('筛选请求失败'))
    options.selectedCategory.value = '工作复盘'
    await settle()
    expect(state.error.value).toBeTruthy()
    expect(state.posts.value.map((post) => post.id)).toEqual(original)
    await state.refresh()
    await settle()
    expect(state.error.value).toBeFalsy()
    expect(state.posts.value.map((post) => post.id)).toEqual(
      mockPosts.filter((post) => post.folder === '工作复盘').map((post) => post.id),
    )
  })

  it('冷启动连续模式的第3页URL按页补齐完整前缀', async () => {
    const { state } = await setup(3, 'waterfall')
    expect(state.posts.value.map((post) => post.id)).toEqual(mockPosts.slice(0, 45).map((post) => post.id))
  })
  it('追加失败保留首批和总量，重试后不重复或漏页', async () => {
    const { options, state, settle } = await setup()
    options.displayMode.value = 'waterfall'
    await settle()
    vi.mocked(fetchPostPage).mockRejectedValueOnce(new Error('临时网络错误'))
    options.page.value = 2
    await settle()
    expect(state.error.value).toBeTruthy()
    expect(state.posts.value.map((post) => post.id)).toEqual(mockPosts.slice(0, 15).map((post) => post.id))
    expect(state.total.value).toBe(mockPosts.length)
    await state.refresh()
    await settle()
    expect(state.error.value).toBeFalsy()
    expect(state.posts.value.map((post) => post.id)).toEqual(mockPosts.slice(0, 30).map((post) => post.id))
  })

  it('旧分类的迟到响应不能覆盖新分类结果', async () => {
    const { options, state, settle } = await setup()
    let resolveOld!: (value: Awaited<ReturnType<typeof fetchPostPage>>) => void
    vi.mocked(fetchPostPage).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve
        }),
    )
    options.page.value = 2
    await settle()
    await vi.waitFor(() => expect(resolveOld).toBeTypeOf('function'))
    options.selectedCategory.value = '工作复盘'
    await settle()
    const expected = mockPosts.filter((post) => post.folder === '工作复盘').map((post) => post.id)
    await vi.waitFor(() => expect(state.posts.value.map((post) => post.id)).toEqual(expected))
    resolveOld({ items: mockPosts.slice(15, 30), total: mockPosts.length, page: 2, pageSize: 15 })
    await settle()
    expect(state.posts.value.map((post) => post.id)).toEqual(expected)
  })
  it.each([1, 3])('分页第%d页切连续后，从第一页累积完整有序集合', async (startingPage) => {
    const { options, state, settle } = await setup()
    options.page.value = startingPage
    await settle()
    options.displayMode.value = 'waterfall'
    await settle()
    expect(options.page.value).toBe(1)
    expect(state.posts.value.map((post) => post.id)).toEqual(mockPosts.slice(0, 15).map((post) => post.id))
    for (let page = 2; page <= Math.ceil(mockPosts.length / 15); page++) {
      options.page.value = page
      await settle()
    }
    expect(state.posts.value.map((post) => post.id)).toEqual(mockPosts.map((post) => post.id))
    expect(new Set(state.posts.value.map((post) => post.id)).size).toBe(mockPosts.length)
  })

  it('连续加载后的新筛选不会混入旧分类或旧页', async () => {
    const { options, state, settle } = await setup()
    options.displayMode.value = 'waterfall'
    await settle()
    options.page.value = 2
    await settle()
    options.selectedCategory.value = '工作复盘'
    await settle()
    expect(options.page.value).toBe(1)
    expect(state.posts.value.map((post) => post.id)).toEqual(
      mockPosts.filter((post) => post.folder === '工作复盘').map((post) => post.id),
    )
  })
})
