/**
 * @file postMetadata.test.ts
 * @description 归档与侧栏共享统计在首次失败、刷新失败和恢复时的真实数据边界
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { usePostMetadata } from '../../app/composables/usePostMetadata'
import { fetchPostMetadata } from '../../app/features/post/api'
import type { PostMetadata } from '../../app/features/post/types'

vi.mock('../../app/features/post/api', () => ({ fetchPostMetadata: vi.fn() }))
const wrappers: { unmount(): void }[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.resetAllMocks()
})
const sample: PostMetadata = {
  tags: [{ label: '测试标签', slug: 'test', color: 'sky', count: 1 }],
  categories: [{ name: '测试分类', count: 1 }],
  stats: { posts: 1, views: 5, comments: 2, tags: 1, uptimeDays: 1 },
  archive: [{ id: 'post-1', title: '已发布文章', folder: '测试分类', date: '2026-09-08' }],
}

async function setup() {
  let state!: Awaited<ReturnType<typeof usePostMetadata>>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        async setup() {
          clearNuxtData('post-metadata')
          clearNuxtState('post-metadata-retained')
          state = await usePostMetadata()
          return () => h('div', state.metadata.value ? String(state.metadata.value.stats.posts) : 'unavailable')
        },
      }),
    ),
  )
  return state
}

describe('文章共享统计恢复', () => {
  it('首次失败不伪造空数据，重试后归档、分类和统计共同恢复', async () => {
    vi.mocked(fetchPostMetadata).mockRejectedValueOnce(new Error('service unavailable'))
    const state = await setup()
    expect(state.error.value).toBeTruthy()
    expect(state.metadata.value).toBeUndefined()
    vi.mocked(fetchPostMetadata).mockResolvedValue(sample)
    await state.refresh()
    expect(state.error.value).toBeFalsy()
    expect(state.siteStats.value?.articles).toBe(1)
    expect(state.archiveYears.value[0]?.posts[0]?.title).toBe('已发布文章')
    expect(state.categories.value[0]?.name).toBe('测试分类')
  })

  it('刷新失败保留已读归档，恢复时接受新的真实统计', async () => {
    vi.mocked(fetchPostMetadata).mockResolvedValueOnce(sample)
    const state = await setup()
    await nextTick()
    vi.mocked(fetchPostMetadata).mockRejectedValueOnce(new Error('network failed'))
    await state.refresh()
    expect(state.error.value).toBeTruthy()
    expect(state.metadata.value).toEqual(sample)
    vi.mocked(fetchPostMetadata).mockResolvedValueOnce({ ...sample, stats: { ...sample.stats, views: 9 } })
    await state.refresh()
    expect(state.error.value).toBeFalsy()
    expect(state.metadata.value?.stats.views).toBe(9)
  })
})
