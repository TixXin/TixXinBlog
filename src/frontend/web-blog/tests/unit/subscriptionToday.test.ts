/** @file subscriptionToday.test.ts @description SSR 日期首帧、UTC 午夜、会话重新进入及恢复可见的日期刷新 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { useSubscriptionToday } from '../../app/composables/useSubscriptionToday'
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  vi.setSystemTime(new Date('2026-10-13T23:59:59.000Z'))
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.useRealTimers()
})
async function setup(previous?: string) {
  let today!: ReturnType<typeof useSubscriptionToday>,
    beforeMount = ''
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        if (previous) useState('subscriptions-today').value = previous
        today = useSubscriptionToday()
        beforeMount = today.value
        return () => h('p', today.value)
      },
    }),
  )
  wrappers.push(wrapper)
  return { today, beforeMount, wrapper }
}
it('首次水合沿用已有日期，客户端挂载修正会话留下的旧日', async () => {
  const state = await setup('2026-10-12')
  expect(state.beforeMount).toBe('2026-10-12')
  expect(state.today.value).toBe('2026-10-13')
})
it('跨 UTC 午夜更新，卸载后停止计时，重新进入与恢复可见立即重核日期', async () => {
  const state = await setup('2026-10-13')
  await vi.advanceTimersByTimeAsync(2000)
  expect(state.today.value).toBe('2026-10-14')
  wrappers.pop()!.unmount()
  vi.setSystemTime(new Date('2026-10-16T08:00:00.000Z'))
  const reentered = await setup()
  expect(reentered.today.value).toBe('2026-10-16')
  vi.setSystemTime(new Date('2026-10-17T08:00:00.000Z'))
  window.dispatchEvent(new Event('pageshow'))
  expect(reentered.today.value).toBe('2026-10-17')
})
