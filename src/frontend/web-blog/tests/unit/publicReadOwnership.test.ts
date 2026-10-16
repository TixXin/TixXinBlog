/** @file publicReadOwnership.test.ts @description 同键共享读取与旧失效入口并存时的真实生命周期回归 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { usePublicReadData } from '../../app/composables/usePublicReadData'
import { publicReadCache } from '../../app/utils/publicReadCache'

const key = 'shared-public-read-ownership'
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  publicReadCache(useNuxtApp()).invalidate(['post-summary'])
  clearNuxtData(key)
})
afterEach(async () => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  await nextTick()
  vi.restoreAllMocks()
})
async function mountReader(loader: () => Promise<{ title: string }>) {
  let result!: ReturnType<typeof usePublicReadData<{ title: string }>>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        async setup() {
          result = usePublicReadData(key, loader, { domain: 'post-summary', kind: 'metadata' })
          await result
          return () => h('div', result.data.value?.title)
        },
      }),
    ),
  )
  return result
}

it('壳层与页面共享统计时，刷新失败为每个订阅保留最后成功结果', async () => {
  const loader = vi.fn(async () => ({ title: '已确认统计' }))
  const shell = await mountReader(loader)
  const page = await mountReader(loader)
  expect(loader).toHaveBeenCalledTimes(1)
  loader.mockRejectedValueOnce(new Error('短暂断连'))
  await page.refresh()
  expect(shell.error.value).toBeTruthy()
  expect(page.error.value).toBeTruthy()
  expect(shell.data.value?.title).toBe('已确认统计')
  expect(page.data.value?.title).toBe('已确认统计')
})

it('壳层仍持有同键时，新页面订阅也执行过期统计的后台重验证', async () => {
  let now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  const loader = vi.fn(async () => ({ title: '原统计' }))
  await mountReader(loader)
  now += 61_000
  loader.mockResolvedValueOnce({ title: '外部更新后的统计' })
  const page = await mountReader(loader)
  await flushPromises()
  expect(loader).toHaveBeenCalledTimes(2)
  expect(page.data.value?.title).toBe('外部更新后的统计')
})

it('中央失效之后的旧 clearNuxtData 调用不能让活跃订阅永久空闲', async () => {
  const loader = vi.fn(async () => ({ title: '写入前统计' }))
  const state = await mountReader(loader)
  let finish!: (value: { title: string }) => void
  loader.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  async function completeAdminWrite() {
    publicReadCache(useNuxtApp()).invalidate(['post-summary'])
    return { ok: true }
  }
  await completeAdminWrite()
  clearNuxtData(key)
  await flushPromises()
  if (finish) finish({ title: '写入后统计' })
  await flushPromises()
  expect(state.status.value).not.toBe('idle')
})
