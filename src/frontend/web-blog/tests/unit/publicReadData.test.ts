/** @file publicReadData.test.ts @description 公开读取在真实 AsyncData 下的回访、重验证、手动刷新与失效竞态 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { usePublicReadData } from '../../app/composables/usePublicReadData'
import { publicReadCache } from '../../app/utils/publicReadCache'

const wrappers: { unmount(): void }[] = []
beforeEach(() => publicReadCache(useNuxtApp()).invalidate())
afterEach(async () => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  await nextTick()
  vi.restoreAllMocks()
})
async function setup(loader: (signal: AbortSignal, page: number) => Promise<{ page: number; title: string }>) {
  const page = ref(1)
  let result!: ReturnType<typeof usePublicReadData<{ page: number; title: string }>>
  const wrapper = await mountSuspended(
    defineComponent({
      async setup() {
        result = usePublicReadData('public-read-unit', (_app, { signal }) => loader(signal, page.value), {
          domain: 'projects',
          query: () => ({ page: page.value }),
        })
        await result
        return () => h('div', result.data.value?.title)
      },
    }),
  )
  wrappers.push(wrapper)
  return { result, page, wrapper }
}
describe('公开 AsyncData 缓存', () => {
  it('卸载后回访命中缓存，手动刷新仍请求真实数据', async () => {
    const loader = vi.fn(async (_signal, page) => ({ page, title: '当前内容' }))
    const first = await setup(loader)
    first.wrapper.unmount()
    wrappers.pop()
    await nextTick()
    const second = await setup(loader)
    expect(loader).toHaveBeenCalledTimes(1)
    expect(second.result.data.value?.title).toBe('当前内容')
    await second.result.refresh()
    expect(loader).toHaveBeenCalledTimes(2)
  })
  it('过期返回立即显示并后台刷新，失败保留内容与真实错误', async () => {
    let now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const loader = vi.fn(async (_signal, page) => ({ page, title: '已读取内容' }))
    const first = await setup(loader)
    first.wrapper.unmount()
    wrappers.pop()
    await nextTick()
    now += 31_000
    loader.mockRejectedValueOnce(new Error('暂时离线'))
    const second = await setup(loader)
    await flushPromises()
    expect(second.result.data.value?.title).toBe('已读取内容')
    expect(second.result.error.value).toBeTruthy()
    expect(second.result.stale.value).toBe(true)
  })
  it('切回缓存查询会取消尚未结束的其他查询', async () => {
    let oldSignal!: AbortSignal
    let resolveOld!: (value: { page: number; title: string }) => void
    const loader = vi.fn(async (_signal, page) => ({ page, title: `第${page}页` }))
    const { result, page } = await setup(loader)
    loader.mockImplementationOnce((signal) => {
      oldSignal = signal
      return new Promise((resolve) => {
        resolveOld = resolve
      })
    })
    page.value = 2
    void result.reload()
    await flushPromises()
    page.value = 1
    await result.reload()
    expect(oldSignal.aborted).toBe(true)
    expect(result.data.value?.page).toBe(1)
    resolveOld({ page: 2, title: '迟到内容' })
    await flushPromises()
    expect(result.data.value?.page).toBe(1)
  })
  it('已确认写入后清除旧结果，旧请求不能恢复已撤回内容', async () => {
    let resolveOld!: (value: { page: number; title: string }) => void
    const loader = vi.fn(async (_signal, page) => ({ page, title: '已发布' }))
    const { result } = await setup(loader)
    loader.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve
        }),
    )
    void result.refresh()
    await flushPromises()
    loader.mockResolvedValue({ page: 1, title: '更新后的列表' })
    publicReadCache(useNuxtApp()).invalidate(['projects'])
    expect(result.data.value).toBeUndefined()
    await flushPromises()
    expect(result.data.value?.title).toBe('更新后的列表')
    resolveOld({ page: 1, title: '已撤回' })
    await flushPromises()
    expect(result.data.value?.title).toBe('更新后的列表')
    expect(result.generation.value).toBeGreaterThan(0)
  })
})
