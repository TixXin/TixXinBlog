/** @file pageRequestBoundary.test.ts @description 根组件在旧布局卸载后消费页面所有者取消，普通错误继续进入应用错误处理 */
import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, Suspense } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import App from '../../app/app.vue'
import { PageRequestCancellation } from '../../app/utils/pageRequestCancellation'

mockNuxtImport('useKeyboardShortcuts', () => () => {})
mockNuxtImport('useAppLoading', () => () => ({
  isLoading: ref(false),
  isThemeSwitchLoading: ref(false),
  checkFirstVisit: () => false,
  dismiss: () => {},
}))
const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

it.each([
  ['cancelled', false],
  ['error', false],
  ['same-message', false],
  ['cancelled', true],
  ['error', true],
] as const)('旧布局移除后迟到的 %s 仍经过持久根边界，等待期间更新=%s', async (kind, updatePending) => {
  const visible = ref(true)
  const revision = ref(0)
  let reject!: (error: Error) => void
  const pending = new Promise<void>((_resolve, fail) => {
    reject = fail
  })
  const child = defineComponent({
    async setup() {
      await pending
      return () => h('p', '旧页面')
    },
  })
  const parent = defineComponent({
    props: { revision: Number },
    setup: (props) => () => h(child, { revision: props.revision }),
  })
  const oldLayout = defineComponent({
    setup: () => () =>
      h(Suspense, null, { default: () => h(parent, { revision: revision.value }), fallback: () => h('p', '正在加载') }),
  })
  const layoutSlot = defineComponent({
    setup: () => () => (visible.value ? h(oldLayout) : h('main', '新页面')),
  })
  const onError = vi.fn()
  wrappers.push(
    mount(App, {
      global: {
        config: { errorHandler: onError },
        stubs: {
          NuxtLayout: layoutSlot,
          CommonAppLoadingTopBar: true,
          CommonAppLoadingScreen: true,
          ClientOnly: true,
        },
      },
    }),
  )
  await nextTick()
  if (updatePending) {
    // 对应路由尚未解析时父组件更新props；Vue会给asyncDep追加一次延后更新任务。
    revision.value++
    await nextTick()
  }
  visible.value = false
  await nextTick()
  const error =
    kind === 'cancelled'
      ? new PageRequestCancellation()
      : new Error(kind === 'same-message' ? '页面已离开，停止后续初始化' : '真实读取失败')
  reject(error)
  await flushPromises()
  if (kind === 'cancelled') expect(onError).not.toHaveBeenCalled()
  else {
    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0]?.[0]).toBe(error)
  }
})

it('等待中的父props更新在异步子树成功解析后仍渲染最新值', async () => {
  const revision = ref(0)
  let resolve!: () => void
  const pending = new Promise<void>((done) => {
    resolve = done
  })
  const child = defineComponent({
    props: { revision: Number },
    async setup(props) {
      await pending
      return () => h('p', { 'data-ready-revision': '' }, String(props.revision))
    },
  })
  const parent = defineComponent({
    props: { revision: Number },
    setup: (props) => () => h(child, { revision: props.revision }),
  })
  const layout = defineComponent({
    setup: () => () =>
      h(Suspense, null, {
        default: () => h(parent, { revision: revision.value }),
        fallback: () => h('p', '正在加载'),
      }),
  })
  const onError = vi.fn()
  const wrapper = mount(App, {
    global: {
      config: { errorHandler: onError },
      stubs: {
        NuxtLayout: layout,
        CommonAppLoadingTopBar: true,
        CommonAppLoadingScreen: true,
        ClientOnly: true,
      },
    },
  })
  wrappers.push(wrapper)
  await nextTick()
  revision.value = 1
  await nextTick()
  revision.value = 2
  await nextTick()
  resolve()
  await flushPromises()
  await nextTick()
  expect(wrapper.find('[data-ready-revision]').text()).toBe('2')
  expect(onError).not.toHaveBeenCalled()
})
