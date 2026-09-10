/** @vitest-environment node */
/** @file manifestLifecycle.test.ts @description 执行实际 Nuxt payload 插件，验证预取定时器的卸载、恢复与拒绝处理 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { getEventListeners } from 'node:events'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const pluginPath = new URL('./plugins/payload.client.js', pathToFileURL(require.resolve('nuxt/app')))
// 只替换模块依赖；运行已安装且经过 pnpm 补丁的原插件，不复制被测定时器实现。
const source = readFileSync(pluginPath, 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export { plugin as default };', 'return plugin;')
const loadPlugin = new Function(
  'defineNuxtPlugin',
  'useRouter',
  'injectHead',
  'onNuxtReady',
  'stateDiagnostics',
  'getAppManifest',
  'isCachedPayloadRoute',
  'loadPayload',
  'appManifest',
  'prefetchPreloadTags',
  'purgeCachedData',
  'withoutFragment',
  'window',
  'navigator',
  'setTimeout',
  'clearTimeout',
  source,
)

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())
function setup(effectiveType = '4g') {
  let ready!: () => void, unmount: (() => void) | undefined
  let navigate!: (to: { path: string; fullPath: string }, from: { path: string; fullPath: string }) => Promise<void>
  const browser = new EventTarget()
  const getManifest = vi.fn().mockResolvedValue({ prerendered: [] })
  const loadPayload = vi.fn().mockResolvedValue(null)
  const plugin = loadPlugin(
    (value: unknown) => value,
    () => ({ afterEach: vi.fn(), beforeResolve: (callback: typeof navigate) => (navigate = callback) }),
    vi.fn(),
    (callback: () => void) => (ready = callback),
    { NUXT_E7003: vi.fn() },
    getManifest,
    () => false,
    loadPayload,
    true,
    false,
    true,
    (value: string) => value.split('#')[0],
    browser,
    { connection: { effectiveType } },
    setTimeout,
    clearTimeout,
  )
  plugin.setup({
    hooks: { hook: vi.fn() },
    static: { data: {} },
    vueApp: { onUnmount: (callback: () => void) => (unmount = callback) },
  })
  return { browser, ready, getManifest, loadPayload, navigate, unmount: () => unmount?.() }
}

it('正常页面只在就绪一秒后预取一次', async () => {
  const state = setup()
  state.ready()
  await vi.advanceTimersByTimeAsync(999)
  expect(state.getManifest).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect(state.getManifest).toHaveBeenCalledOnce()
})
it.each(['beforeunload', 'pagehide'])('%s 在定时器到期前暂停预取，旧文档不再发请求', async (event) => {
  const state = setup()
  state.ready()
  await vi.advanceTimersByTimeAsync(900)
  state.browser.dispatchEvent(new Event(event))
  await vi.advanceTimersByTimeAsync(1100)
  expect(state.getManifest).not.toHaveBeenCalled()
})
it('卸载后迟到的 onNuxtReady 不能新建定时器，pageshow 后才恢复', async () => {
  const state = setup()
  state.browser.dispatchEvent(new Event('beforeunload'))
  state.ready()
  await vi.advanceTimersByTimeAsync(1000)
  expect(state.getManifest).not.toHaveBeenCalled()
  state.browser.dispatchEvent(new Event('pageshow'))
  await vi.advanceTimersByTimeAsync(1000)
  expect(state.getManifest).toHaveBeenCalledOnce()
})
it('暂停预取不影响用户取消卸载后按需导航的 payload 读取', async () => {
  const state = setup()
  state.ready()
  state.browser.dispatchEvent(new Event('beforeunload', { cancelable: true }))
  await state.navigate({ path: '/gallery', fullPath: '/gallery' }, { path: '/projects', fullPath: '/projects' })
  expect(state.loadPayload).toHaveBeenCalledWith('/gallery')
  await vi.advanceTimersByTimeAsync(1000)
  expect(state.getManifest).not.toHaveBeenCalled()
})
it('预取拒绝被处理，页面恢复后仍可重新调用清单数据源', async () => {
  const state = setup()
  state.getManifest.mockRejectedValueOnce(new Error('清单暂不可用'))
  state.ready()
  await vi.advanceTimersByTimeAsync(1000)
  expect(state.getManifest).toHaveBeenCalledOnce()
  state.browser.dispatchEvent(new Event('pagehide'))
  state.browser.dispatchEvent(new Event('pageshow'))
  await vi.advanceTimersByTimeAsync(1000)
  expect(state.getManifest).toHaveBeenCalledTimes(2)
})
it('应用卸载移除监听与定时器，迟到恢复事件不再预取', async () => {
  const state = setup()
  const remove = vi.spyOn(state.browser, 'removeEventListener')
  state.ready()
  state.unmount()
  state.browser.dispatchEvent(new Event('pageshow'))
  state.ready()
  await vi.advanceTimersByTimeAsync(1000)
  expect(remove.mock.calls.map(([name]) => name).sort()).toEqual(['beforeunload', 'pagehide', 'pageshow'])
  expect(state.getManifest).not.toHaveBeenCalled()
})
it('慢速网络继续跳过非必要预取', async () => {
  const state = setup('slow-2g')
  state.ready()
  await vi.advanceTimersByTimeAsync(1000)
  expect(state.getManifest).not.toHaveBeenCalled()
  expect(getEventListeners(state.browser, 'beforeunload')).toHaveLength(0)
})
it('仅就绪前与定时器待执行时监听 beforeunload，预取开始即释放监听', async () => {
  const state = setup()
  expect(getEventListeners(state.browser, 'beforeunload')).toHaveLength(1)
  state.ready()
  expect(getEventListeners(state.browser, 'beforeunload')).toHaveLength(1)
  let finish!: () => void
  state.getManifest.mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)))
  await vi.advanceTimersByTimeAsync(1000)
  expect(state.getManifest).toHaveBeenCalledOnce()
  expect(getEventListeners(state.browser, 'beforeunload')).toHaveLength(0)
  finish()
})
it('pagehide 暂停时移除 guard，pageshow 重新调度时恢复并在到期后释放', async () => {
  const state = setup()
  state.ready()
  state.browser.dispatchEvent(new Event('pagehide'))
  expect(getEventListeners(state.browser, 'beforeunload')).toHaveLength(0)
  state.browser.dispatchEvent(new Event('pageshow'))
  expect(getEventListeners(state.browser, 'beforeunload')).toHaveLength(1)
  await vi.advanceTimersByTimeAsync(1000)
  expect(getEventListeners(state.browser, 'beforeunload')).toHaveLength(0)
  expect(state.getManifest).toHaveBeenCalledOnce()
})
